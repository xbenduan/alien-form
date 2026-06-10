import { describe, expect, it } from 'vitest';
import { createForm } from './form';
import type { ArrayFieldNode, IFormSchema } from './types';

function arrayField(form: ReturnType<typeof createForm>, path: string): ArrayFieldNode {
  const f = form.field(path);
  if (!f || f.kind !== 'array') throw new Error(`array field "${path}" missing`);
  return f;
}

const itemSchema = (): IFormSchema => ({
  type: 'object',
  properties: {
    materials: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' } } },
    },
  },
});

describe('array — push', () => {
  it('appends a row with provided initial values', async () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.push({ name: 'b' });
    expect(arr.rows().length).toBe(2);
    expect(form.get('materials[].name')).toEqual(['a', 'b']);
    await expect(form.submit()).resolves.toEqual({ materials: [{ name: 'a' }, { name: 'b' }] });
  });

  it('appends an empty row when no initial values are given', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [] } });
    const arr = arrayField(form, 'materials');
    arr.push();
    expect(arr.rows().length).toBe(1);
    expect(form.field('materials.0.name')).toBeDefined();
  });
});

describe('array — remove', () => {
  it('removes a row by index and reindexes the remaining rows', async () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } });
    const arr = arrayField(form, 'materials');
    arr.remove(1);
    expect(arr.rows().length).toBe(2);
    expect(form.get('materials[].name')).toEqual(['a', 'c']);
    // path of the row that was at index 2 is now index 1
    expect(form.get('materials.1.name')).toBe('c');
    await expect(form.submit()).resolves.toEqual({ materials: [{ name: 'a' }, { name: 'c' }] });
  });

  it('is a safe no-op for a negative index', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.remove(-1);
    expect(arr.rows().length).toBe(1);
  });

  it('is a safe no-op for an out-of-range index', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.remove(5);
    expect(arr.rows().length).toBe(1);
  });

  it('disposes removed row fields from the flat fields map', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.remove(1);
    // the formerly-last row child path must no longer resolve to a distinct field
    expect(form.get('materials[].name')).toEqual(['a']);
  });
});

describe('array — move / moveUp / moveDown', () => {
  it('moves a row from one index to another and reindexes', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } });
    const arr = arrayField(form, 'materials');
    arr.move(0, 2);
    expect(form.get('materials[].name')).toEqual(['b', 'c', 'a']);
  });

  it('moveUp shifts a row toward the front', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.moveUp(1);
    expect(form.get('materials[].name')).toEqual(['b', 'a']);
  });

  it('moveDown shifts a row toward the back', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.moveDown(0);
    expect(form.get('materials[].name')).toEqual(['b', 'a']);
  });

  it('move is a no-op when from === to', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.move(1, 1);
    expect(form.get('materials[].name')).toEqual(['a', 'b']);
  });

  it('moveUp at index 0 is a safe no-op (target -1)', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    expect(() => arr.moveUp(0)).not.toThrow();
    expect(form.get('materials[].name')).toEqual(['a', 'b']);
  });

  it('moveDown at the last index is a safe no-op (target past end)', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    expect(() => arr.moveDown(1)).not.toThrow();
    expect(form.get('materials[].name')).toEqual(['a', 'b']);
  });

  it('move is a no-op for an out-of-range source index', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.move(9, 0);
    expect(form.get('materials[].name')).toEqual(['a']);
  });
});

describe('array — setRows', () => {
  it('replaces all rows wholesale', async () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.setRows([{ name: 'x' }, { name: 'y' }]);
    expect(form.get('materials[].name')).toEqual(['x', 'y']);
    await expect(form.submit()).resolves.toEqual({ materials: [{ name: 'x' }, { name: 'y' }] });
  });

  it('clears all rows when given an empty array', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.setRows([]);
    expect(arr.rows().length).toBe(0);
  });

  it('coerces a non-array argument to an empty row set', () => {
    const form = createForm({ schema: itemSchema(), initialValues: { materials: [{ name: 'a' }] } });
    const arr = arrayField(form, 'materials');
    arr.setRows(null as any);
    expect(arr.rows().length).toBe(0);
  });
});

describe('array — nested arrays', () => {
  const nestedSchema = (): IFormSchema => ({
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phones: {
              type: 'array',
              items: { type: 'object', properties: { number: { type: 'string' } } },
            },
          },
        },
      },
    },
  });

  it('reindexes nested array child paths after an outer remove', async () => {
    const form = createForm({
      schema: nestedSchema(),
      initialValues: {
        contacts: [
          { name: 'A', phones: [{ number: '1' }] },
          { name: 'B', phones: [{ number: '2' }, { number: '3' }] },
        ],
      },
    });
    const contacts = arrayField(form, 'contacts');
    contacts.remove(0);
    // B is now contact 0, its nested phones must be addressable at the new path
    expect(form.get('contacts.0.name')).toBe('B');
    expect(form.get('contacts.0.phones.0.number')).toBe('2');
    expect(form.get('contacts.0.phones.1.number')).toBe('3');
    await expect(form.submit()).resolves.toEqual({
      contacts: [{ name: 'B', phones: [{ number: '2' }, { number: '3' }] }],
    });
  });

  it('supports pushing onto a nested array after reindex', () => {
    const form = createForm({
      schema: nestedSchema(),
      initialValues: { contacts: [{ name: 'A', phones: [] }, { name: 'B', phones: [] }] },
    });
    const contacts = arrayField(form, 'contacts');
    contacts.remove(0);
    const phones = arrayField(form, 'contacts.0.phones');
    phones.push({ number: '999' });
    expect(form.get('contacts.0.phones.0.number')).toBe('999');
  });
});

describe('array — reset', () => {
  it('resets array rows back to the schema default', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          default: [{ name: 'default' }],
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const form = createForm({ schema, initialValues: { materials: [{ name: 'a' }, { name: 'b' }] } });
    const arr = arrayField(form, 'materials');
    arr.reset();
    expect(form.get('materials[].name')).toEqual(['default']);
  });
});
