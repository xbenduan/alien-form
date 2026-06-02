import {
  AppStore,
  type CmsModelSchema as PackageCmsModelSchema,
  type ModelSummary,
  type RecordProvider,
  type RecordListParams,
  type SchemaListParams,
  type RecordDetailParams,
  type RecordCreateParams,
  type RecordUpdateParams,
  type RecordDeleteParams,
  type RecordBatchDeleteParams,
  type SchemaProvider,
} from '@alien-form/cms';
import type { ModelSource } from '../types/model';
import { DexieRepository } from './repository/dexie-repository';
import { modelSchemaRepository } from './repository/model-schema-repository';
import { getDefaultModelName, listStaticModelSummaries, loadStaticSchema } from './schema/static-schema-source';

const recordRepository = new DexieRepository();

function toModelSummary(schema: PackageCmsModelSchema): ModelSummary {
  const modelName = schema['x-model']?.name ?? 'unknown';
  return {
    name: modelName,
    title: schema['x-model']?.title ?? schema.title ?? modelName,
    subtitle: schema['x-model']?.subtitle,
    description: schema['x-model']?.description ?? schema.description,
    source: 'runtime',
  };
}

function filterSummariesByKeyword(list: ModelSummary[], keyword?: string) {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return list;
  }

  return list.filter((item) =>
    [item.name, item.title, item.subtitle, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedKeyword)),
  );
}

const localSchemaProvider: SchemaProvider = {
  async list(params?: SchemaListParams) {
    const staticSummaries = listStaticModelSummaries() as ModelSummary[];
    const runtimeSummaries = (await modelSchemaRepository.listSummaries()) as ModelSummary[];
    const merged = [...staticSummaries, ...runtimeSummaries].sort((left, right) => left.name.localeCompare(right.name));
    const filtered = filterSummariesByKeyword(merged, params?.keyword);
    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? (filtered.length || 1);
    const start = (current - 1) * pageSize;

    return {
      list: filtered.slice(start, start + pageSize),
      total: filtered.length,
    };
  },

  async detail({ modelName }) {
    const staticSchema = loadStaticSchema(modelName);
    if (staticSchema) {
      return staticSchema as unknown as PackageCmsModelSchema;
    }

    const runtimeSchema = await modelSchemaRepository.get(modelName);
    if (runtimeSchema) {
      return runtimeSchema as unknown as PackageCmsModelSchema;
    }

    throw new Error(`未找到模型 schema: ${modelName}`);
  },

  async create({ schema }) {
    const record = await modelSchemaRepository.save(schema as never);
    return {
      success: true,
      data: toModelSummary(record.schema as unknown as PackageCmsModelSchema),
    };
  },

  async update({ schema }) {
    const record = await modelSchemaRepository.save(schema as never);
    return {
      success: true,
      data: toModelSummary(record.schema as unknown as PackageCmsModelSchema),
    };
  },

  async delete({ modelName }) {
    await modelSchemaRepository.delete(modelName);
    return {
      success: true,
    };
  },

  async exists(modelName: string) {
    if (loadStaticSchema(modelName)) {
      return true;
    }

    return modelSchemaRepository.exists(modelName);
  },
};

const localRecordProvider: RecordProvider = {
  async list(params: RecordListParams) {
    return recordRepository.list(params);
  },

  async detail({ model, id }: RecordDetailParams) {
    return recordRepository.detail(model, id);
  },

  async create({ model, values }: RecordCreateParams) {
    const record = await recordRepository.create(model, values);
    return {
      success: true,
      data: record,
    };
  },

  async update({ model, id, values }: RecordUpdateParams) {
    const record = await recordRepository.update(model, id, values);
    return {
      success: true,
      data: record,
    };
  },

  async delete({ model, id }: RecordDeleteParams) {
    await recordRepository.remove(model, id);
    return {
      success: true,
    };
  },

  async batchDelete({ model, ids }: RecordBatchDeleteParams) {
    for (const id of ids) {
      await recordRepository.remove(model, id);
    }

    return {
      success: true,
      data: {
        deleted: ids.length,
      },
    };
  },
};

export const cmsAppStore = new AppStore({
  localSchemaProvider,
  localRecordProvider,
});

export async function listModelSummaries() {
  const result = await cmsAppStore.schemaProvider().list();
  return result.list;
}

export async function loadSchema(modelName: string) {
  return await cmsAppStore.schemaProvider().detail({ modelName });
}

export async function saveSchema(schema: PackageCmsModelSchema, modelName?: string) {
  if (modelName) {
    return cmsAppStore.schemaProvider().update({ modelName, schema: schema as unknown as PackageCmsModelSchema });
  }

  return cmsAppStore.schemaProvider().create({ schema: schema as unknown as PackageCmsModelSchema });
}

export async function deleteSchema(modelName: string) {
  return cmsAppStore.schemaProvider().delete({ modelName });
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

export { getDefaultModelName, loadStaticSchema, listStaticModelSummaries };
