import { describe, expect, it } from 'vitest';
import { createForm } from './form';
import type { IFormSchema } from './types';

describe('createForm runtime and projection', () => {
  it('defers runtime reactions until mount', async () => {
    let calls = 0;
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        serviceIds: {
          type: 'tags',
          'x-reaction': {
            dataSource: '@loadDataSource',
          },
        },
      },
    };

    const form = createForm({
      schema,
      handlers: {
        loadDataSource() {
          calls += 1;
          return [];
        },
      },
    });

    expect(calls).toBe(0);

    form.mount();

    expect(calls).toBe(1);
  });

  it('can remount runtime after unmount without losing fields', () => {
    let calls = 0;
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        serviceIds: {
          type: 'tags',
          'x-reaction': {
            dataSource: '@loadDataSource',
          },
        },
      },
    };

    const form = createForm({
      schema,
      handlers: {
        loadDataSource() {
          calls += 1;
          return [];
        },
      },
    });

    form.mount();
    form.unmount();
    form.mount();

    expect(form.field('serviceIds')).toBeDefined();
    expect(calls).toBe(2);
  });

  it('flattens void field children into parent values', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        deliverySection: {
          type: 'void',
          properties: {
            landingPage: {
              type: 'string',
            },
            trackingCode: {
              type: 'string',
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        landingPage: 'https://before.example.com',
        trackingCode: 'OLD',
      },
    });

    form.set('landingPage', 'https://after.example.com');
    form.set('trackingCode', 'NEW');

    await expect(form.submit()).resolves.toEqual({
      landingPage: 'https://after.example.com',
      trackingCode: 'NEW',
    });
  });

  it('keeps array object item values after edit', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
              },
              format: {
                type: 'string',
              },
              owner: {
                type: 'string',
              },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        materials: [
          {
            name: '旧素材',
            format: 'banner',
            owner: 'Luna',
          },
        ],
      },
    });

    form.set('materials.0.name', '新素材');
    form.set('materials.0.format', 'video');
    form.set('materials.0.owner', 'Mika');

    await expect(form.submit()).resolves.toEqual({
      materials: [
        {
          name: '新素材',
          format: 'video',
          owner: 'Mika',
        },
      ],
    });
  });

  it('keeps array object item values after editing from empty row object', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
              },
              format: {
                type: 'string',
              },
              owner: {
                type: 'string',
              },
              enabled: {
                type: 'boolean',
              },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        materials: [{}],
      },
    });

    form.set('materials.0.name', '111');
    form.set('materials.0.format', 'banner');
    form.set('materials.0.owner', '111');
    form.set('materials.0.enabled', true);

    await expect(form.submit()).resolves.toEqual({
      materials: [
        {
          name: '111',
          format: 'banner',
          owner: '111',
          enabled: true,
        },
      ],
    });
  });

  it('relinks stale row children before projecting array item values', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        materials: [{}],
      },
    });

    const materials = form.field('materials');
    if (!materials || materials.kind !== 'array') {
      throw new Error('materials field missing');
    }

    materials.rows()[0]?.children.clear();

    form.set('materials.0.name', '修复后素材');
    form.set('materials.0.format', 'video');

    await expect(form.submit()).resolves.toEqual({
      materials: [
        {
          name: '修复后素材',
          format: 'video',
        },
      ],
    });
  });

  it('applies x-format input on initialization only and output on submit', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          'x-format': {
            input: ({ value }) => typeof value === 'string' ? value.trim() : value,
            output: '@wrapName',
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        name: '  Alice  ',
      },
      handlers: {
        wrapName({ value }) {
          return typeof value === 'string' ? `[${value}]` : value;
        },
      },
    });

    expect(form.get('name')).toBe('Alice');

    form.set('name', '  Bob  ');

    expect(form.get('name')).toBe('  Bob  ');
    await expect(form.submit()).resolves.toEqual({
      name: '[  Bob  ]',
    });
  });

  it('filters invalid multi-select values on initialization when dataSourcePolicy is filter', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'tags',
          dataSourcePolicy: 'filter',
          dataSource: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        tags: ['a', 'x', 'b'],
      },
    });

    expect(form.get('tags')).toEqual(['a', 'b']);
  });

  it('switches to the first option when dataSourcePolicy is first and current value becomes invalid', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          dataSourcePolicy: 'first',
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        role: 'ghost',
      },
    });

    const role = form.field('role');
    if (!role || role.kind !== 'primitive') {
      throw new Error('role field missing');
    }

    role.setDataSource([
      { label: 'Admin', value: 'admin' },
      { label: 'User', value: 'user' },
    ]);

    expect(form.get('role')).toBe('admin');
  });

  it('reads primitive values from array item selectors', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        materials: [
          { name: '海报', format: 'image' },
          { name: '视频', format: 'video' },
        ],
      },
    });

    expect(form.get('materials[].name')).toEqual(['海报', '视频']);
  });

  it('reads nested array item selectors', () => {
    const schema: IFormSchema = {
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
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        contacts: [
          {
            name: 'Alice',
            phones: [{ number: '111' }, { number: '222' }],
          },
          {
            name: 'Bob',
            phones: [{ number: '333' }],
          },
        ],
      },
    });

    expect(form.get('contacts[].phones.0.number')).toEqual(['111', '333']);
  });

  it('reads $row first-level selectors inside row runtime', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              summary: {
                type: 'string',
                'x-reaction': {
                  value: '@readRowName',
                },
              },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        contacts: [
          { name: 'Alice' },
          { name: 'Bob' },
        ],
      },
      handlers: {
        readRowName(runtime) {
          return runtime.get('$row.name');
        },
      },
    });

    form.mount();

    expect(form.get('contacts.0.summary')).toBe('Alice');
    expect(form.get('contacts.1.summary')).toBe('Bob');
  });

  it('reads $row nested selectors inside row runtime', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                },
              },
              summary: {
                type: 'string',
                'x-reaction': {
                  value: '@readRowCity',
                },
              },
            },
          },
        },
      },
    };

    const form = createForm({
      schema,
      initialValues: {
        contacts: [
          { profile: { city: 'Shanghai' } },
          { profile: { city: 'Beijing' } },
        ],
      },
      handlers: {
        readRowCity(runtime) {
          return runtime.get('$row.profile.city');
        },
      },
    });

    form.mount();

    expect(form.get('contacts.0.summary')).toBe('Shanghai');
    expect(form.get('contacts.1.summary')).toBe('Beijing');
  });
});

describe('set selector get/set parity', () => {
  // ── direct: single absolute/index selector still writes correctly (regression guard) ──
  it('direct: writes a single array-item primitive selector', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { materials: [{ name: 'a' }, { name: 'b' }] },
    });

    form.set('materials.0.name', 'A0');

    expect(form.get('materials.0.name')).toBe('A0');
    expect(form.get('materials.1.name')).toBe('b');
  });

  // ── nested (collection): set('coll[].child') broadcasts to every row, mirroring get ──
  it('nested: broadcasts a collection selector to every array row', async () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { materials: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
    });

    // read parity already exists; now the write must mirror it
    expect(form.get('materials[].name')).toEqual(['a', 'b', 'c']);

    form.set('materials[].name', 'Z');

    expect(form.get('materials[].name')).toEqual(['Z', 'Z', 'Z']);
    await expect(form.submit()).resolves.toEqual({
      materials: [{ name: 'Z' }, { name: 'Z' }, { name: 'Z' }],
    });
  });

  // ── nested ($row): writing a nested $row child path from inside row runtime ──
  it('nested: writes a nested $row child selector inside row runtime', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              profile: { type: 'object', properties: { city: { type: 'string' } } },
              trigger: { type: 'string', 'x-reaction': { value: '@writeCity' } },
            },
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { contacts: [{ profile: { city: 'old' } }] },
      handlers: {
        writeCity(runtime) {
          runtime.set('$row.profile.city', 'WRITTEN');
          return 'done';
        },
      },
    });

    form.mount();

    expect(form.get('contacts.0.profile.city')).toBe('WRITTEN');
  });

  // ── nested ($row collection): set('$row.arr[].child') broadcasts within the row ──
  it('nested: broadcasts a $row collection selector within the row', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phones: {
                type: 'array',
                items: { type: 'object', properties: { number: { type: 'string' } } },
              },
              trigger: { type: 'string', 'x-reaction': { value: '@maskPhones' } },
            },
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { contacts: [{ phones: [{ number: 'P1' }, { number: 'P2' }] }] },
      handlers: {
        maskPhones(runtime) {
          runtime.set('$row.phones[].number', '***');
          return 'done';
        },
      },
    });

    form.mount();

    expect(form.get('contacts.0.phones[].number')).toEqual(['***', '***']);
  });

  // ── invalid: collection selector against a non-array field reports error, no write ──
  it('invalid: collection selector on a non-array field emits error and writes nothing', () => {
    const errors: string[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    };
    const form = createForm({
      schema,
      initialValues: { title: 'keep' },
      onError: (e) => errors.push(e.message),
    });

    form.set('title[].name', 'X');

    expect(form.get('title')).toBe('keep');
    expect(errors.some((m) => m.includes('is not an array field'))).toBe(true);
  });

  // ── invalid: setting a non-primitive (object) selector reports error, no crash ──
  it('invalid: setting a non-primitive object selector emits error and does not throw', () => {
    const errors: string[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        profile: { type: 'object', properties: { city: { type: 'string' } } },
      },
    };
    const form = createForm({
      schema,
      initialValues: { profile: { city: 'sh' } },
      onError: (e) => errors.push(e.message),
    });

    expect(() => form.set('profile', { city: 'bj' })).not.toThrow();
    expect(form.get('profile.city')).toBe('sh');
    expect(errors.some((m) => m.includes('Cannot set non-primitive selector'))).toBe(true);
  });

  // ── out-of-range: direct index past the end is a no-op (no ghost rows, no throw) ──
  it('out-of-range: writing past the last array index is a safe no-op', async () => {
    const errors: string[] = [];
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { materials: [{ name: 'a' }] },
      onError: (e) => errors.push(e.message),
    });

    expect(() => form.set('materials.5.name', 'ghost')).not.toThrow();

    // no ghost row created
    const materials = form.field('materials');
    if (!materials || materials.kind !== 'array') throw new Error('materials missing');
    expect(materials.rows().length).toBe(1);
    await expect(form.submit()).resolves.toEqual({ materials: [{ name: 'a' }] });
  });

  // ── out-of-range: empty collection broadcast writes nothing and does not throw ──
  it('out-of-range: collection broadcast on an empty array writes nothing', () => {
    const schema: IFormSchema = {
      type: 'object',
      properties: {
        materials: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { materials: [] },
    });

    expect(() => form.set('materials[].name', 'Z')).not.toThrow();
    expect(form.get('materials[].name')).toEqual([]);
  });
});
