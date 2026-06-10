import { describe, expect, it } from 'vitest';
import * as api from './index';

describe('public API surface (index.ts)', () => {
  it('exports the core factory', () => {
    expect(typeof api.createForm).toBe('function');
  });

  it('re-exports alien-signals primitives', () => {
    for (const name of ['signal', 'computed', 'effect', 'startBatch', 'endBatch'] as const) {
      expect(typeof api[name]).toBe('function');
    }
  });

  it('re-exports ref-resolve helpers', () => {
    expect(typeof api.resolveSchemaRef).toBe('function');
    expect(typeof api.resolveSchemaTree).toBe('function');
  });

  it('re-exports path helpers', () => {
    expect(typeof api.getDeepValue).toBe('function');
    expect(typeof api.setDeepValue).toBe('function');
    expect(typeof api.sortByOrder).toBe('function');
  });

  it('re-exports the expression evaluator and validation helpers', () => {
    expect(typeof api.evaluateExpression).toBe('function');
    expect(typeof api.normalizeDataSource).toBe('function');
    expect(typeof api.isEmptyValue).toBe('function');
  });

  it('a smoke-test form built only through the public API works end-to-end', async () => {
    const form = api.createForm({
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      initialValues: { name: 'hi' },
    });
    expect(form.get('name')).toBe('hi');
    await expect(form.submit()).resolves.toEqual({ name: 'hi' });
  });
});
