import { describe, expect, it } from 'vitest';
import { createForm } from './form';
import type { FormError, IFormSchema } from './types';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('runtime context — project() inside a rule handler', () => {
  it('projects the current field when project() is called with no selector', () => {
    let projected: any;
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        group: {
          type: 'object',
          properties: { x: { type: 'string' } },
          'x-effect': '@captureSelf',
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { group: { x: 'hi' } },
      handlers: { captureSelf: (rt) => { projected = rt.project(); } },
    });
    form.mount();
    expect(projected).toEqual({ x: 'hi' });
  });

  it('projects a relative sibling selector from within a rule handler', () => {
    let projected: any;
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string', 'x-effect': '@captureSibling' },
      },
    };
    const form = createForm({
      schema,
      initialValues: { a: 'sibling-val', b: '' },
      handlers: { captureSibling: (rt) => { projected = rt.project('a'); } },
    });
    form.mount();
    expect(projected).toBe('sibling-val');
  });

  it('returns undefined when project() targets an unknown selector', () => {
    let projected: any = 'sentinel';
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-effect': '@captureMissing' } },
    };
    const form = createForm({
      schema,
      handlers: { captureMissing: (rt) => { projected = rt.project('does.not.exist'); } },
    });
    form.mount();
    expect(projected).toBeUndefined();
  });
});

describe('runtime context — async x-effect non-function resolution', () => {
  it('ignores an async x-effect that resolves to a non-function (no disposer registered)', async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-effect': '@asyncNonFn' } },
    };
    const form = createForm({
      schema,
      onError: (e) => errors.push(e),
      handlers: { asyncNonFn: async () => { await tick(); return 'not-a-function'; } },
    });
    form.mount();
    await tick();
    await tick();
    // no error, and destroy must not throw despite no disposer being registered
    expect(errors.length).toBe(0);
    expect(() => form.destroy()).not.toThrow();
  });
});

describe('runtime context — effect() helper exposed to handlers', () => {
  it('lets a handler register a raw effect via runtime.effect', () => {
    const runs: number[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number', 'x-effect': '@watchA' },
      },
    };
    const form = createForm({
      schema,
      initialValues: { a: 1 },
      handlers: {
        watchA: (rt) => rt.effect(() => { runs.push(rt.get('a')); }),
      },
    });
    form.mount();
    expect(runs).toContain(1);
    form.set('a', 2);
    expect(runs).toContain(2);
  });
});
