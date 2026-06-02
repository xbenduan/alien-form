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
import type { ModelSource, RuntimeModelSchemaRecord } from '../../domains/record/types/record';
import { dexieRecordService } from '../record-service/dexie-record-service';
import { dexieSchemaService } from '../schema-service/dexie-schema-service';
import {
  getDefaultModelName,
  listStaticModelSummaries,
  listStaticSchemas,
  loadStaticSchema,
} from '../schema-service/static-schema-service';

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

function getFieldCount(schema?: PackageCmsModelSchema) {
  return Object.keys(schema?.properties ?? {}).length;
}

function toRuntimeSummary(record: RuntimeModelSchemaRecord): ModelSummary {
  return {
    name: record.modelName,
    title: record.title,
    subtitle: record.subtitle,
    description: record.description,
    source: record.source === 'static-override' ? 'static' : 'runtime',
    updatedAt: record.updatedAt,
    fieldCount: getFieldCount(record.schema as PackageCmsModelSchema | undefined),
  };
}

async function getResolvedSchemaRecordMap() {
  const localRecords = await dexieSchemaService.listRecords();
  return new Map(localRecords.map((item) => [item.modelName, item]));
}

const schemaProvider: SchemaProvider = {
  async list(params?: SchemaListParams) {
    const staticSchemas = listStaticSchemas();
    const localRecordMap = await getResolvedSchemaRecordMap();
    const merged: ModelSummary[] = [];

    for (const { modelName, schema } of staticSchemas) {
      const localRecord = localRecordMap.get(modelName);
      if (localRecord?.deleted) {
        continue;
      }

      if (localRecord?.schema) {
        merged.push(toRuntimeSummary(localRecord));
        continue;
      }

      merged.push({
        name: modelName,
        title: schema['x-model']?.title ?? schema.title ?? modelName,
        subtitle: schema['x-model']?.subtitle,
        description: schema['x-model']?.description ?? schema.description,
        source: 'static',
        fieldCount: getFieldCount(schema as PackageCmsModelSchema),
      });
    }

    for (const localRecord of localRecordMap.values()) {
      if (localRecord.deleted || localRecord.source === 'static-override' || !localRecord.schema) {
        continue;
      }
      merged.push(toRuntimeSummary(localRecord));
    }

    const deduped = merged.sort((left, right) => left.name.localeCompare(right.name));
    const filtered = filterSummariesByKeyword(deduped, params?.keyword);
    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? (filtered.length || 1);
    const start = (current - 1) * pageSize;

    return {
      list: filtered.slice(start, start + pageSize),
      total: filtered.length,
    };
  },

  async detail({ modelName }) {
    const localRecord = await dexieSchemaService.getRecord(modelName);
    if (localRecord?.deleted) {
      throw new Error(`未找到模型 schema: ${modelName}`);
    }

    if (localRecord?.schema) {
      return localRecord.schema as unknown as PackageCmsModelSchema;
    }

    const staticSchema = loadStaticSchema(modelName);
    if (staticSchema) {
      return staticSchema as unknown as PackageCmsModelSchema;
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
    const modelName = schema['x-model']?.name ?? 'unknown';
    const staticSchema = loadStaticSchema(modelName);
    const record = await dexieSchemaService.save(schema as never, {
      source: staticSchema ? 'static-override' : 'runtime',
    });
    return {
      success: true,
      data: toModelSummary(record.schema as unknown as PackageCmsModelSchema),
    };
  },

  async delete({ modelName }) {
    const staticSchema = loadStaticSchema(modelName);
    await dexieSchemaService.delete(modelName, staticSchema
      ? {
          source: 'static',
          title: staticSchema['x-model']?.title ?? staticSchema.title ?? modelName,
          subtitle: staticSchema['x-model']?.subtitle,
          description: staticSchema['x-model']?.description ?? staticSchema.description,
        }
      : undefined);
    return {
      success: true,
    };
  },

  async exists(modelName: string) {
    const localRecord = await dexieSchemaService.getRecord(modelName);
    if (localRecord?.deleted) {
      return false;
    }

    if (localRecord?.schema) {
      return true;
    }

    if (loadStaticSchema(modelName)) {
      return true;
    }

    return false;
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
  const localRecord = await dexieSchemaService.getRecord(modelName);
  if (localRecord?.deleted) {
    return undefined;
  }

  if (localRecord?.schema) {
    return localRecord.source === 'static-override' ? 'static' : 'runtime';
  }

  if (loadStaticSchema(modelName)) {
    return 'static';
  }

  return undefined;
}

export { getDefaultModelName, listStaticModelSummaries, loadStaticSchema };
