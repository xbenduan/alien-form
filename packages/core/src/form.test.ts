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
});
