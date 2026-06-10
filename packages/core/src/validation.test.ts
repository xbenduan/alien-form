import { describe, expect, it } from 'vitest';
import { isEmptyValue, normalizeDataSource, normalizeValidationErrors } from './validation';

describe('isEmptyValue', () => {
  it('treats undefined / null / empty string / empty array as empty', () => {
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
  });
  it('treats 0, false, and non-empty values as non-empty', () => {
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue('x')).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
    expect(isEmptyValue({})).toBe(false);
  });
});

describe('normalizeDataSource', () => {
  it('returns [] for null / undefined / non-array', () => {
    expect(normalizeDataSource(null)).toEqual([]);
    expect(normalizeDataSource(undefined)).toEqual([]);
    expect(normalizeDataSource('x' as any)).toEqual([]);
  });
  it('wraps primitive string/number items into label/value pairs', () => {
    expect(normalizeDataSource(['a', 1])).toEqual([
      { label: 'a', value: 'a' },
      { label: '1', value: 1 },
    ]);
  });
  it('maps {key,title} shape into {label,value} while preserving extra props', () => {
    expect(normalizeDataSource([{ key: 'k1', title: 'T1', extra: 9 } as any])).toEqual([
      { label: 'T1', value: 'k1', key: 'k1', title: 'T1', extra: 9 },
    ]);
  });
  it('passes through already-normalized {label,value} items', () => {
    const item = { label: 'L', value: 'v' };
    expect(normalizeDataSource([item])).toEqual([item]);
  });
});

describe('normalizeValidationErrors', () => {
  it('returns [] for undefined / null / true', () => {
    expect(normalizeValidationErrors(undefined)).toEqual([]);
    expect(normalizeValidationErrors(null)).toEqual([]);
    expect(normalizeValidationErrors(true)).toEqual([]);
  });
  it('maps false to a generic invalid error', () => {
    expect(normalizeValidationErrors(false)).toEqual([{ message: 'Invalid value', type: 'x-validate' }]);
  });
  it('maps a string to a single error', () => {
    expect(normalizeValidationErrors('boom')).toEqual([{ message: 'boom', type: 'x-validate' }]);
  });
  it('maps an array of mixed results, skipping passing entries', () => {
    const out = normalizeValidationErrors([true, 'e1', false, null, { message: 'e2', type: 'custom' }]);
    expect(out).toEqual([
      { message: 'e1', type: 'x-validate' },
      { message: 'Invalid value', type: 'x-validate' },
      { message: 'e2', type: 'custom' },
    ]);
  });
  it('maps a single error object, defaulting its type', () => {
    expect(normalizeValidationErrors({ message: 'only-msg' })).toEqual([{ message: 'only-msg', type: 'x-validate' }]);
  });
  it('ignores object results without a message field', () => {
    expect(normalizeValidationErrors({ notMessage: 1 } as any)).toEqual([]);
  });
});
