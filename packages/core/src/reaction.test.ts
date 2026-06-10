import { describe, expect, it, vi } from 'vitest';
import { createForm } from './form';
import type { FormError, IFormSchema, PrimitiveFieldNode } from './types';

function primitive(form: ReturnType<typeof createForm>, path: string): PrimitiveFieldNode {
  const f = form.field(path);
  if (!f || f.kind !== 'primitive') throw new Error(`primitive "${path}" missing`);
  return f;
}

describe('reaction — value target', () => {
  it('drives a primitive value from a handler reaction', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number', 'x-reaction': { value: '@double' } },
      },
    };
    const form = createForm({
      schema,
      initialValues: { a: 3 },
      handlers: { double: (rt) => (rt.get('a') ?? 0) * 2 },
    });
    form.mount();
    expect(form.get('b')).toBe(6);
  });

  it('recomputes the dependent value reactively when the source changes', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number', 'x-reaction': { value: '@double' } },
      },
    };
    const form = createForm({
      schema,
      initialValues: { a: 1 },
      handlers: { double: (rt) => (rt.get('a') ?? 0) * 2 },
    });
    form.mount();
    expect(form.get('b')).toBe(2);
    form.set('a', 10);
    expect(form.get('b')).toBe(20);
  });

  it('warns when value reaction targets a non-primitive field', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        group: { type: 'object', properties: { x: { type: 'string' } }, 'x-reaction': { value: '@bad' } },
      },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e), handlers: { bad: () => 'oops' } });
    form.mount();
    expect(errors.some((e) => e.key === 'value' && e.message.includes('only valid for primitive'))).toBe(true);
  });

  it('ignores an undefined reaction result (no overwrite)', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { value: '@maybe' } } },
    };
    const form = createForm({ schema, initialValues: { a: 'keep' }, handlers: { maybe: () => undefined } });
    form.mount();
    expect(form.get('a')).toBe('keep');
  });
});

describe('reaction — display / disabled / required', () => {
  it('toggles display via a boolean-driven expression', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        toggle: { type: 'boolean' },
        secret: { type: 'string', 'x-reaction': { display: "{{ toggle ? 'visible' : 'none' }}" } },
      },
    };
    const form = createForm({ schema, initialValues: { toggle: false } });
    form.mount();
    expect(primitive(form, 'secret').display()).toBe('none');
    form.set('toggle', true);
    expect(primitive(form, 'secret').display()).toBe('visible');
  });

  it('sets disabled from a reaction', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        locked: { type: 'boolean' },
        name: { type: 'string', 'x-reaction': { disabled: '{{ locked }}' } },
      },
    };
    const form = createForm({ schema, initialValues: { locked: true } });
    form.mount();
    expect(primitive(form, 'name').disabled()).toBe(true);
  });

  it('sets required from a reaction', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        needed: { type: 'boolean' },
        name: { type: 'string', 'x-reaction': { required: '{{ needed }}' } },
      },
    };
    const form = createForm({ schema, initialValues: { needed: true } });
    form.mount();
    expect(primitive(form, 'name').required()).toBe(true);
  });
});

describe('reaction — presentation targets', () => {
  it('updates title and description', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', 'x-reaction': { title: '@t', description: '@d' } },
      },
    };
    const form = createForm({ schema, handlers: { t: () => 'Title!', d: () => 'Desc!' } });
    form.mount();
    expect(primitive(form, 'name').title()).toBe('Title!');
    expect(primitive(form, 'name').description()).toBe('Desc!');
  });

  it('merges componentProps via the props target', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', props: { a: 1 }, 'x-reaction': { props: '@p' } },
      },
    };
    const form = createForm({ schema, handlers: { p: () => ({ b: 2 }) } });
    form.mount();
    expect(primitive(form, 'name').componentProps()).toEqual({ a: 1, b: 2 });
  });

  it('merges decoratorProps via the decoratorProps target', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', decoratorProps: { x: 1 }, 'x-reaction': { decoratorProps: '@dp' } },
      },
    };
    const form = createForm({ schema, handlers: { dp: () => ({ y: 2 }) } });
    form.mount();
    expect(primitive(form, 'name').decoratorProps()).toEqual({ x: 1, y: 2 });
  });

  it('swaps component (string form) and component+props (tuple form)', () => {
    const schemaString: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { component: '@c' } } },
    };
    const f1 = createForm({ schema: schemaString, handlers: { c: () => 'Select' } });
    f1.mount();
    expect(primitive(f1, 'a').component()).toBe('Select');

    const schemaTuple: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { component: '@c' } } },
    };
    const f2 = createForm({ schema: schemaTuple, handlers: { c: () => ['Switch', { size: 'lg' }] } });
    f2.mount();
    expect(primitive(f2, 'a').component()).toBe('Switch');
    expect(primitive(f2, 'a').componentProps()).toMatchObject({ size: 'lg' });
  });

  it('swaps decorator (string and tuple forms)', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { decorator: '@d' } } },
    };
    const form = createForm({ schema, handlers: { d: () => ['Card', { bordered: true }] } });
    form.mount();
    expect(primitive(form, 'a').decorator()).toBe('Card');
    expect(primitive(form, 'a').decoratorProps()).toMatchObject({ bordered: true });
  });

  it('drives dataSource from a reaction', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { sel: { type: 'string', 'x-reaction': { dataSource: '@ds' } } },
    };
    const form = createForm({ schema, handlers: { ds: () => [{ label: 'A', value: 'a' }] } });
    form.mount();
    expect(primitive(form, 'sel').dataSource()).toEqual([{ label: 'A', value: 'a' }]);
  });
});

describe('reaction — rows target', () => {
  it('sets array rows from a reaction', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
          'x-reaction': { rows: '@seed' },
        },
      },
    };
    const form = createForm({ schema, handlers: { seed: () => [{ name: 'r1' }, { name: 'r2' }] } });
    form.mount();
    expect(form.get('items[].name')).toEqual(['r1', 'r2']);
  });

  it('warns when rows reaction targets a non-array field', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { rows: '@seed' } } },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e), handlers: { seed: () => [] } });
    form.mount();
    expect(errors.some((e) => e.key === 'rows' && e.message.includes('only valid for array'))).toBe(true);
  });
});

describe('reaction — unknown target and multiple rules', () => {
  it('warns on an unknown reaction target key', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { bogusTarget: '@x' } as any } },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e), handlers: { x: () => 1 } });
    form.mount();
    expect(errors.some((e) => e.message.includes('Unknown x-reaction target'))).toBe(true);
  });

  it('runs every rule when a target maps to an array of rules', () => {
    const calls: string[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', 'x-reaction': { title: ['@t1', '@t2'] } },
      },
    };
    const form = createForm({
      schema,
      handlers: { t1: () => { calls.push('t1'); return 'one'; }, t2: () => { calls.push('t2'); return 'two'; } },
    });
    form.mount();
    // both rules must execute (effects may re-run; assert membership, not exact count)
    expect(calls).toContain('t1');
    expect(calls).toContain('t2');
    // last rule wins for the same target
    expect(primitive(form, 'name').title()).toBe('two');
  });
});

describe('reaction — handler resolution failures', () => {
  it('reports a missing handler reference', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@nope' } } },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e) });
    form.mount();
    expect(errors.some((e) => e.message.includes('Handler "nope" not found'))).toBe(true);
  });

  it('captures a synchronous throw inside a reaction handler', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@boom' } } },
    };
    const form = createForm({
      schema,
      onError: (e) => errors.push(e),
      handlers: { boom: () => { throw new Error('kaboom'); } },
    });
    form.mount();
    expect(errors.some((e) => e.message.includes('kaboom'))).toBe(true);
  });

  it('does not run any reaction before mount', () => {
    const spy = vi.fn(() => 'v');
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-reaction': { value: '@h' } } },
    };
    createForm({ schema, handlers: { h: spy } });
    expect(spy).not.toHaveBeenCalled();
  });
});
