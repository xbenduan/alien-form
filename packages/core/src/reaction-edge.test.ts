import { describe, expect, it, vi } from 'vitest';
import { createForm } from './form';
import type { FormError, IFormSchema, PrimitiveFieldNode } from './types';

function primitive(form: ReturnType<typeof createForm>, path: string): PrimitiveFieldNode {
  const f = form.field(path);
  if (!f || f.kind !== 'primitive') throw new Error(`primitive "${path}" missing`);
  return f;
}

describe('reaction — inline function rules', () => {
  it('executes an inline function reaction (not just @handler strings)', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number', 'x-reaction': { value: (rt) => (rt.get('a') ?? 0) + 1 } },
      },
    };
    const form = createForm({ schema, initialValues: { a: 41 } });
    form.mount();
    expect(form.get('b')).toBe(42);
  });

  it('captures a throw from an inline function reaction', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { value: () => { throw new Error('inline-boom'); } } } },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e) });
    form.mount();
    expect(errors.some((e) => e.message.includes('inline-boom'))).toBe(true);
  });
});

describe('reaction — literal (non-handler, non-expression) rules', () => {
  it('treats a plain literal string as the value itself', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { value: 'literal-text' } } },
    };
    const form = createForm({ schema });
    form.mount();
    expect(form.get('a')).toBe('literal-text');
  });

  it('treats a plain object literal as a props payload', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { a: { type: 'string', 'x-reaction': { props: { placeholder: 'hi' } } } },
    };
    const form = createForm({ schema });
    form.mount();
    expect(primitive(form, 'a').componentProps()).toMatchObject({ placeholder: 'hi' });
  });
});

describe('set — $row without an enclosing row', () => {
  it('emits an error when $row.<child> is set outside any row', () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const form = createForm({ schema, onError: (e) => errors.push(e) });
    // root-level set of a $row selector has no enclosing row
    form.set('$row.name', 'x');
    expect(errors.some((e) => e.message.includes('no enclosing row'))).toBe(true);
  });

  it('emits an error for an empty selector', () => {
    const errors: FormError[] = [];
    const form = createForm({ schema: { type: 'object', properties: { a: { type: 'string' } } }, onError: (e) => errors.push(e) });
    form.set('', 'x');
    expect(errors.some((e) => e.message.includes('Cannot set empty selector'))).toBe(true);
  });
});

describe('dataSourcePolicy — array (multi-select) values', () => {
  it('clear: empties a multi-select when the option set changes', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { tags: { type: 'tags', dataSourcePolicy: 'clear' } },
    };
    const form = createForm({ schema, initialValues: { tags: ['a', 'b'] } });
    primitive(form, 'tags').setDataSource([{ label: 'C', value: 'c' }]);
    expect(form.get('tags')).toEqual([]);
  });

  it('first: keeps valid selections when at least one remains', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { tags: { type: 'tags', dataSourcePolicy: 'first' } },
    };
    const form = createForm({ schema, initialValues: { tags: ['a', 'x'] } });
    primitive(form, 'tags').setDataSource([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]);
    expect(form.get('tags')).toEqual(['a']);
  });

  it('first: falls back to the first option when no current selection is valid', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { tags: { type: 'tags', dataSourcePolicy: 'first' } },
    };
    const form = createForm({ schema, initialValues: { tags: ['x', 'y'] } });
    primitive(form, 'tags').setDataSource([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]);
    expect(form.get('tags')).toEqual(['a']);
  });

  it('preserve: leaves invalid selections untouched', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { tags: { type: 'tags', dataSourcePolicy: 'preserve' } },
    };
    const form = createForm({ schema, initialValues: { tags: ['ghost'] } });
    primitive(form, 'tags').setDataSource([{ label: 'A', value: 'a' }]);
    expect(form.get('tags')).toEqual(['ghost']);
  });

  it('clear: empties a single-select when its value becomes invalid', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: { role: { type: 'string', dataSourcePolicy: 'clear' } },
    };
    const form = createForm({ schema, initialValues: { role: 'ghost' } });
    primitive(form, 'role').setDataSource([{ label: 'Admin', value: 'admin' }]);
    expect(form.get('role')).toBeUndefined();
  });
});

describe('reaction — function returning a disposer via x-effect inline', () => {
  it('runs an inline x-effect function and disposes it on destroy', () => {
    const dispose = vi.fn();
    const schema: IFormSchema = {
      type: 'object',
      properties: { name: { type: 'string', 'x-effect': () => dispose } },
    };
    const form = createForm({ schema });
    form.mount();
    form.destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
