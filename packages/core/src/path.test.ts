import { describe, expect, it } from 'vitest';
import { getDeepValue, setDeepValue, sortByOrder } from './path';
import type { IFieldSchema } from './types';

describe('getDeepValue', () => {
  it('reads a nested value by dotted path', () => {
    expect(getDeepValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });
  it('reads a top-level value', () => {
    expect(getDeepValue({ a: 1 }, 'a')).toBe(1);
  });
  it('returns undefined when the path breaks on a null/undefined branch', () => {
    expect(getDeepValue({ a: null }, 'a.b')).toBeUndefined();
    expect(getDeepValue({ a: { b: undefined } }, 'a.b.c')).toBeUndefined();
  });
  it('returns undefined for a null/undefined root', () => {
    expect(getDeepValue(null, 'a')).toBeUndefined();
    expect(getDeepValue(undefined, 'a')).toBeUndefined();
  });
  it('returns undefined for an empty path', () => {
    expect(getDeepValue({ a: 1 }, '')).toBeUndefined();
  });
  it('reads through array indices expressed as path segments', () => {
    expect(getDeepValue({ list: [{ v: 'x' }, { v: 'y' }] }, 'list.1.v')).toBe('y');
  });
});

describe('setDeepValue', () => {
  it('sets a top-level value', () => {
    const obj: Record<string, any> = {};
    setDeepValue(obj, 'a', 1);
    expect(obj).toEqual({ a: 1 });
  });
  it('creates intermediate objects for missing keys', () => {
    const obj: Record<string, any> = {};
    setDeepValue(obj, 'a.b.c', 9);
    expect(obj).toEqual({ a: { b: { c: 9 } } });
  });
  it('creates an array when the next segment is numeric', () => {
    const obj: Record<string, any> = {};
    setDeepValue(obj, 'list.0.v', 'x');
    expect(Array.isArray(obj.list)).toBe(true);
    expect(obj.list[0]).toEqual({ v: 'x' });
  });
  it('overwrites a non-object intermediate with the correct container type', () => {
    const obj: Record<string, any> = { a: 5 };
    setDeepValue(obj, 'a.b', 1);
    expect(obj.a).toEqual({ b: 1 });
  });
  it('preserves existing sibling values when writing', () => {
    const obj: Record<string, any> = { a: { keep: true } };
    setDeepValue(obj, 'a.added', 1);
    expect(obj.a).toEqual({ keep: true, added: 1 });
  });
  it('is a no-op for an empty path', () => {
    const obj: Record<string, any> = { a: 1 };
    setDeepValue(obj, '', 9);
    expect(obj).toEqual({ a: 1 });
  });
});

describe('sortByOrder', () => {
  it('orders properties by ascending order field', () => {
    const props: Record<string, IFieldSchema> = {
      c: { type: 'string', order: 3 },
      a: { type: 'string', order: 1 },
      b: { type: 'string', order: 2 },
    };
    expect(sortByOrder(props).map(([k]) => k)).toEqual(['a', 'b', 'c']);
  });
  it('treats missing order as Infinity (pushed to the end)', () => {
    const props: Record<string, IFieldSchema> = {
      noOrder: { type: 'string' },
      first: { type: 'string', order: 0 },
    };
    expect(sortByOrder(props).map(([k]) => k)).toEqual(['first', 'noOrder']);
  });
  it('keeps a stable-enough order for equal/absent order values', () => {
    const props: Record<string, IFieldSchema> = {
      x: { type: 'string' },
      y: { type: 'string' },
    };
    const keys = sortByOrder(props).map(([k]) => k);
    expect(keys).toContain('x');
    expect(keys).toContain('y');
    expect(keys.length).toBe(2);
  });
});
