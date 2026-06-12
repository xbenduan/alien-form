import { describe, expect, it, vi } from 'vitest';
import { createForm } from './form';
import type { IFormSchema } from './types';

const flat = (): IFormSchema => ({
  type: 'object',
  properties: { a: { type: 'number' }, b: { type: 'string' } },
});

describe('form.effect — runner overload', () => {
  it('runs the runner reactively and disposes via the returned handle', () => {
    const seen: number[] = [];
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    const dispose = form.effect((f) => { seen.push(f.get('a')); });
    expect(seen).toContain(1);
    form.set('a', 2);
    expect(seen).toContain(2);
    dispose();
    form.set('a', 3);
    expect(seen).not.toContain(3);
  });

  it('registers a runner-returned cleanup that the framework owns', () => {
    const cleanup = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    form.effect(() => cleanup);
    form.destroy();
    expect(cleanup).toHaveBeenCalled();
  });
});

describe('form.effect — selector + listener overload', () => {
  it('fires the listener only when the selected value changes', () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    form.effect((f) => f.get('a'), listener);
    // not called on initialization (no immediate)
    expect(listener).not.toHaveBeenCalled();
    form.set('a', 2);
    expect(listener).toHaveBeenCalledWith(2, 1);
  });

  it('respects the immediate option by firing once at init', () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 5 } });
    form.effect((f) => f.get('a'), listener, { immediate: true });
    expect(listener).toHaveBeenCalledWith(5, undefined);
  });

  it('skips the listener when the equals comparator reports no change', () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    // custom equals: treat all numbers as equal -> listener never fires on change
    form.effect((f) => f.get('a'), listener, { equals: () => true });
    form.set('a', 999);
    expect(listener).not.toHaveBeenCalled();
  });

  it('disposes the selector effect and stops firing', () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    const dispose = form.effect((f) => f.get('a'), listener);
    dispose();
    form.set('a', 2);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('form.setValues', () => {
  it('bulk-sets primitive values by path', () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: 'x' } });
    form.setValues({ a: 10, b: 'y' });
    expect(form.get('a')).toBe(10);
    expect(form.get('b')).toBe('y');
  });

  it('ignores undefined entries and leaves existing values intact', () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: 'keep' } });
    form.setValues({ a: 2 });
    expect(form.get('a')).toBe(2);
    expect(form.get('b')).toBe('keep');
  });

  it('is a no-op for a non-object argument', () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    expect(() => form.setValues(null as any)).not.toThrow();
    expect(form.get('a')).toBe(1);
  });

  it('sets array rows through setValues', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        list: { type: 'array', items: { type: 'object', properties: { v: { type: 'string' } } } },
      },
    };
    const form = createForm({ schema, initialValues: { list: [{ v: 'a' }] } });
    form.setValues({ list: [{ v: 'x' }, { v: 'y' }] });
    expect(form.get('list[].v')).toEqual(['x', 'y']);
  });
});

describe('form.reset', () => {
  it('restores primitive fields to their schema defaults', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'number', default: 100 }, b: { type: 'string', default: 'def' } },
    };
    const form = createForm({ schema, initialValues: { a: 1, b: 'x' } });
    form.set('a', 2);
    form.reset();
    expect(form.get('a')).toBe(100);
    expect(form.get('b')).toBe('def');
  });

  it('recursively resets fields nested inside an object field', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        group: {
          type: 'object',
          properties: { inner: { type: 'string', default: 'def' } },
        },
      },
    };
    const form = createForm({ schema, initialValues: { group: { inner: 'changed' } } });
    form.set('group.inner', 'edited');
    form.reset();
    expect(form.get('group.inner')).toBe('def');
  });
});

describe('form.project', () => {
  it('projects the whole form when no selector is given', () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: 'x' } });
    expect(form.project()).toEqual({ a: 1, b: 'x' });
  });

  it('projects a single field by selector', () => {
    const form = createForm({ schema: flat(), initialValues: { a: 7 } });
    expect(form.project('a')).toBe(7);
  });

  it('returns undefined for an unknown selector', () => {
    const form = createForm({ schema: flat() });
    expect(form.project('nope')).toBeUndefined();
  });

  it('keeps an explicit object field as {} even when all children are empty', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        group: {
          type: 'object',
          properties: { inner: { type: 'string' } },
        },
      },
    };
    const form = createForm({ schema });
    expect(form.project()).toEqual({ group: {} });
  });
});

describe('form.setInitialValues + reset interaction', () => {
  it('does not retroactively change current values, only the baseline', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'number' } },
    };
    const form = createForm({ schema, initialValues: { a: 1 } });
    form.setInitialValues({ a: 50 });
    // current value unchanged until a rebuild/reset that reads initial values
    expect(form.get('a')).toBe(1);
  });
});

describe('form.onError listener registration', () => {
  it('invokes added listeners and stops after unsubscribe', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { value: '@missing' } } },
    };
    const seen: string[] = [];
    const form = createForm({ schema });
    const off = form.onError((e) => seen.push(e.message));
    form.mount();
    expect(seen.length).toBeGreaterThan(0);
    off();
    const before = seen.length;
    form.unmount();
    form.mount();
    // listener removed -> no further growth from this listener
    expect(seen.length).toBe(before);
  });
});
