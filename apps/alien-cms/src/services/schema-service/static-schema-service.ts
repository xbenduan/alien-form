import { normalizeSchema } from '@alien-form/cms';
import type { CmsModelSchema, ModelSummary } from '../../domains/record/types/record';

const schemaModules = import.meta.glob('../../../schema/*.json', { eager: true });

function extractModelName(filePath: string) {
  return filePath.match(/\/([^/]+)\.json$/)?.[1];
}

function getRawSchema(mod: unknown) {
  return ((mod as { default?: CmsModelSchema }).default ?? mod) as CmsModelSchema;
}

function getStaticSchemas() {
  return Object.entries(schemaModules)
    .map(([filePath, mod]) => {
      const schema = normalizeSchema(getRawSchema(mod) as never) as unknown as CmsModelSchema;
      return {
        modelName: extractModelName(filePath) ?? schema['x-model']?.name ?? 'unknown',
        schema,
      };
    })
    .sort((left, right) => left.modelName.localeCompare(right.modelName));
}

export function listStaticModelSummaries(): ModelSummary[] {
  return getStaticSchemas().map(({ modelName, schema }) => ({
    name: modelName,
    title: schema['x-model']?.title ?? schema.title ?? '模型工作台',
    subtitle: schema['x-model']?.subtitle,
    description: schema['x-model']?.description ?? schema.description,
    source: 'static',
  }));
}

export function getDefaultModelName() {
  return listStaticModelSummaries()[0]?.name ?? 'article';
}

export function loadStaticSchema(modelName: string): CmsModelSchema | undefined {
  for (const { modelName: currentModelName, schema } of getStaticSchemas()) {
    if (currentModelName === modelName) {
      return schema;
    }
  }

  return undefined;
}
