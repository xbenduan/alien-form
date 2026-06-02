import {
  AppStore,
  type CmsModelSchema as PackageCmsModelSchema,
  type ModelSummary,
  type RecordBatchDeleteParams,
  type RecordCreateParams,
  type RecordDeleteParams,
  type RecordDetailParams,
  type RecordListParams,
  type RecordProvider,
  type RecordUpdateParams,
  type SchemaListParams,
  type SchemaProvider,
} from '@alien-form/cms';
import type { ModelSource } from '../../domains/record/types/record';
import { dexieRecordService } from '../record-service/dexie-record-service';
import { dexieSchemaService } from '../schema-service/dexie-schema-service';
import { getDefaultModelName, listStaticModelSummaries, loadStaticSchema } from '../schema-service/static-schema-service';

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

const schemaProvider: SchemaProvider = {
  async list(params?: SchemaListParams) {
    const staticSummaries = listStaticModelSummaries() as ModelSummary[];
    const runtimeSummaries = (await dexieSchemaService.listSummaries()) as ModelSummary[];
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

    const runtimeSchema = await dexieSchemaService.get(modelName);
    if (runtimeSchema) {
      return runtimeSchema as unknown as PackageCmsModelSchema;
    }

    throw new Error(`未找到模型 schema: ${modelName}`);
  },

  async create({ schema }) {
    const record = await dexieSchemaService.save(schema as never);
    return {
      success: true,
      data: toModelSummary(record.schema as unknown as PackageCmsModelSchema),
    };
  },

  async update({ schema }) {
    const record = await dexieSchemaService.save(schema as never);
    return {
      success: true,
      data: toModelSummary(record.schema as unknown as PackageCmsModelSchema),
    };
  },

  async delete({ modelName }) {
    await dexieSchemaService.delete(modelName);
    return {
      success: true,
    };
  },

  async exists(modelName: string) {
    if (loadStaticSchema(modelName)) {
      return true;
    }

    return dexieSchemaService.exists(modelName);
  },
};

const recordProvider: RecordProvider = {
  async list(params: RecordListParams) {
    return dexieRecordService.list(params);
  },

  async detail({ model, id }: RecordDetailParams) {
    return dexieRecordService.detail(model, id);
  },

  async create({ model, values }: RecordCreateParams) {
    const record = await dexieRecordService.create(model, values);
    return {
      success: true,
      data: record,
    };
  },

  async update({ model, id, values }: RecordUpdateParams) {
    const record = await dexieRecordService.update(model, id, values);
    return {
      success: true,
      data: record,
    };
  },

  async delete({ model, id }: RecordDeleteParams) {
    await dexieRecordService.remove(model, id);
    return {
      success: true,
    };
  },

  async batchDelete({ model, ids }: RecordBatchDeleteParams) {
    for (const id of ids) {
      await dexieRecordService.remove(model, id);
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
  localSchemaProvider: schemaProvider,
  localRecordProvider: recordProvider,
});

export async function resolveModelSource(modelName: string): Promise<ModelSource | undefined> {
  if (loadStaticSchema(modelName)) {
    return 'static';
  }

  if (await dexieSchemaService.exists(modelName)) {
    return 'runtime';
  }

  return undefined;
}

export { getDefaultModelName, listStaticModelSummaries, loadStaticSchema };
