import type { CmsModelSchema, ModelSummary } from '../../types/model';
import { normalizeSchema } from './normalize-schema';

const schemaModules = import.meta.glob('../../../schema/*.json', { eager: true });

function extractModelName(filePath: string) {
  return filePath.match(/\/([^/]+)\.json$/)?.[1];
}

function getRawSchema(mod: unknown) {
  return ((mod as { default?: CmsModelSchema }).default ?? mod) as CmsModelSchema;
}

export function loadSchema(modelName: string): CmsModelSchema {
  for (const [filePath, mod] of Object.entries(schemaModules)) {
    if (extractModelName(filePath) === modelName) {
      return normalizeSchema(getRawSchema(mod));
    }
  }

  throw new Error(`未找到模型 schema: ${modelName}`);
}

export function listModelSummaries(): ModelSummary[] {
  return Object.entries(schemaModules)
    .map(([filePath, mod]) => {
      const schema = normalizeSchema(getRawSchema(mod));
      return {
        name: extractModelName(filePath) ?? schema['x-model']?.name ?? 'unknown',
        title: schema['x-model']?.title ?? schema.title ?? '模型工作台',
        subtitle: schema['x-model']?.subtitle,
        description: schema['x-model']?.description ?? schema.description,
      } satisfies ModelSummary;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getDefaultModelName() {
  return listModelSummaries()[0]?.name ?? 'article';
}
