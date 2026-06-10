import { describe, expect, it, vi } from 'vitest';
import { resolveSchemaRef, resolveSchemaTree } from './ref-resolve';
import type { IFieldSchema } from './types';

describe('resolveSchemaRef — direct resolution', () => {
  it('returns schema unchanged when there is no $ref', () => {
    const schema: IFieldSchema = { type: 'string', title: 'plain' };
    const result = resolveSchemaRef(schema, {});
    expect(result.fromRef).toBe(false);
    expect(result.schema).toBe(schema);
  });

  it('resolves a single-level $ref and strips the $ref key', () => {
    const definitions: Record<string, IFieldSchema> = {
      Name: { type: 'string', title: 'Name field' },
    };
    const result = resolveSchemaRef({ $ref: '#/definitions/Name' }, definitions);
    expect(result.fromRef).toBe(true);
    expect(result.schema.type).toBe('string');
    expect(result.schema.title).toBe('Name field');
    expect((result.schema as any).$ref).toBeUndefined();
  });

  it('lets local props override the referenced definition (local wins)', () => {
    const definitions: Record<string, IFieldSchema> = {
      Name: { type: 'string', title: 'from def', required: false },
    };
    const result = resolveSchemaRef(
      { $ref: '#/definitions/Name', title: 'local override', required: true } as IFieldSchema,
      definitions,
    );
    expect(result.schema.title).toBe('local override');
    expect(result.schema.required).toBe(true);
    expect(result.schema.type).toBe('string');
  });
});

describe('resolveSchemaRef — nested resolution', () => {
  it('resolves a chain of $refs (A -> B -> concrete)', () => {
    const definitions: Record<string, IFieldSchema> = {
      A: { $ref: '#/definitions/B' } as IFieldSchema,
      B: { type: 'number', title: 'leaf' },
    };
    const result = resolveSchemaRef({ $ref: '#/definitions/A' }, definitions);
    expect(result.fromRef).toBe(true);
    expect(result.schema.type).toBe('number');
    expect(result.schema.title).toBe('leaf');
  });

  it('merges local props at each chain level with outermost-local winning', () => {
    const definitions: Record<string, IFieldSchema> = {
      A: { $ref: '#/definitions/B', title: 'A-title' } as IFieldSchema,
      B: { type: 'number', title: 'B-title', description: 'B-desc' },
    };
    const result = resolveSchemaRef(
      { $ref: '#/definitions/A', description: 'caller-desc' } as IFieldSchema,
      definitions,
    );
    // caller's local props override everything below it
    expect(result.schema.description).toBe('caller-desc');
    // A's local title overrides B's title
    expect(result.schema.title).toBe('A-title');
    expect(result.schema.type).toBe('number');
  });
});

describe('resolveSchemaRef — cycle detection (环检测)', () => {
  it('detects a direct self-referential cycle (A -> A) and reports once', () => {
    const onError = vi.fn();
    const definitions: Record<string, IFieldSchema> = {
      A: { $ref: '#/definitions/A' } as IFieldSchema,
    };
    const result = resolveSchemaRef({ $ref: '#/definitions/A' }, definitions, onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('#/definitions/A', expect.stringContaining('Circular $ref'));
    // returns a usable (de-$ref'd) schema instead of throwing / infinite looping
    expect((result.schema as any).$ref).toBeUndefined();
    expect(result.fromRef).toBe(true);
  });

  it('detects an indirect cycle (A -> B -> A) without infinite recursion', () => {
    const onError = vi.fn();
    const definitions: Record<string, IFieldSchema> = {
      A: { $ref: '#/definitions/B' } as IFieldSchema,
      B: { $ref: '#/definitions/A' } as IFieldSchema,
    };
    const result = resolveSchemaRef({ $ref: '#/definitions/A' }, definitions, onError);
    expect(onError).toHaveBeenCalledWith('#/definitions/A', expect.stringContaining('Circular $ref'));
    expect(result.schema).toBeDefined();
  });

  it('does NOT treat sibling reuse of the same def as a cycle', () => {
    const onError = vi.fn();
    const definitions: Record<string, IFieldSchema> = {
      Leaf: { type: 'string' },
      Wrapper: {
        type: 'object',
        properties: {
          a: { $ref: '#/definitions/Leaf' } as IFieldSchema,
          b: { $ref: '#/definitions/Leaf' } as IFieldSchema,
        },
      },
    };
    const result = resolveSchemaTree({ $ref: '#/definitions/Wrapper' } as IFieldSchema, definitions, onError);
    // reusing Leaf twice in disjoint branches is legal, not circular
    expect(onError).not.toHaveBeenCalled();
    expect(result.properties?.a.type).toBe('string');
    expect(result.properties?.b.type).toBe('string');
  });
});

describe('resolveSchemaRef — unresolved refs', () => {
  it('reports an unresolved $ref and returns the original schema', () => {
    const onError = vi.fn();
    const schema = { $ref: '#/definitions/Missing' } as IFieldSchema;
    const result = resolveSchemaRef(schema, {}, onError);
    expect(onError).toHaveBeenCalledWith('#/definitions/Missing', expect.stringContaining('Unresolved $ref'));
    expect(result.fromRef).toBe(false);
    expect(result.schema).toBe(schema);
  });

  it('does not throw when onError is omitted on an unresolved ref', () => {
    expect(() => resolveSchemaRef({ $ref: '#/definitions/Missing' } as IFieldSchema, {})).not.toThrow();
  });

  it('does not throw when onError is omitted on a circular ref', () => {
    const definitions: Record<string, IFieldSchema> = {
      A: { $ref: '#/definitions/A' } as IFieldSchema,
    };
    expect(() => resolveSchemaRef({ $ref: '#/definitions/A' }, definitions)).not.toThrow();
  });
});

describe('resolveSchemaTree — recursive resolution', () => {
  it('resolves $refs inside properties', () => {
    const definitions: Record<string, IFieldSchema> = {
      Field: { type: 'string', title: 'shared' },
    };
    const schema: IFieldSchema = {
      type: 'object',
      properties: { name: { $ref: '#/definitions/Field' } as IFieldSchema },
    };
    const result = resolveSchemaTree(schema, definitions);
    expect(result.properties?.name.title).toBe('shared');
  });

  it('resolves $refs inside array items', () => {
    const definitions: Record<string, IFieldSchema> = {
      Item: { type: 'object', properties: { v: { type: 'number' } } },
    };
    const schema: IFieldSchema = {
      type: 'array',
      items: { $ref: '#/definitions/Item' } as IFieldSchema,
    };
    const result = resolveSchemaTree(schema, definitions);
    expect((result.items as IFieldSchema).properties?.v.type).toBe('number');
  });

  it('leaves tuple-style array items (items as array) untouched', () => {
    const schema: IFieldSchema = {
      type: 'array',
      items: [{ type: 'string' }, { type: 'number' }] as any,
    };
    const result = resolveSchemaTree(schema, {});
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('terminates on a circular ref reached through the tree walk', () => {
    const onError = vi.fn();
    const definitions: Record<string, IFieldSchema> = {
      Node: {
        type: 'object',
        properties: { child: { $ref: '#/definitions/Node' } as IFieldSchema },
      },
    };
    const schema: IFieldSchema = {
      type: 'object',
      properties: { root: { $ref: '#/definitions/Node' } as IFieldSchema },
    };
    // must not stack-overflow; the inner self-ref is flagged
    const result = resolveSchemaTree(schema, definitions, onError);
    expect(result.properties?.root.type).toBe('object');
    expect(onError).toHaveBeenCalledWith('#/definitions/Node', expect.stringContaining('Circular $ref'));
  });
});
