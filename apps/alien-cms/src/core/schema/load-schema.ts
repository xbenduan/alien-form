import type { CmsModelSchema, ModelSource, ModelSummary } from '../../types/model';
import { modelSchemaRepository } from '../../data/repository/model-schema-repository';
import { normalizeSchema } from './normalize-schema';

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
      const schema = normalizeSchema(getRawSchema(mod));
      return {
        modelName: extractModelName(filePath) ?? schema['x-model']?.name ?? 'unknown',
        schema,
      };
    })
    .sort((left, right) => left.modelName.localeCompare(right.modelName));
}

export function getStaticModelNames() {
  return getStaticSchemas().map((item) => item.modelName);
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

export async function listModelSummaries(): Promise<ModelSummary[]> {
  const staticSummaries = listStaticModelSummaries();
  const runtimeSummaries = await modelSchemaRepository.listSummaries();
  const merged = [...staticSummaries, ...runtimeSummaries];
  return merged.sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadSchema(modelName: string): Promise<CmsModelSchema> {
  const staticSchema = loadStaticSchema(modelName);
  if (staticSchema) {
    return staticSchema;
  }

  const runtimeSchema = await modelSchemaRepository.get(modelName);
  if (runtimeSchema) {
    return runtimeSchema;
  }

  throw new Error(`未找到模型 schema: ${modelName}`);
}

export async function resolveModelSource(modelName: string): Promise<ModelSource | undefined> {
  if (loadStaticSchema(modelName)) {
    return 'static';
  }

  if (await modelSchemaRepository.exists(modelName)) {
    return 'runtime';
  }

  return undefined;
}
