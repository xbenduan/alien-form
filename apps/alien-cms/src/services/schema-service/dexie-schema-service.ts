import dayjs from 'dayjs';
import { normalizeSchema } from '@alien-form/cms';
import type {
  CmsModelSchema,
  LocalSchemaRecordSource,
  ModelSource,
  ModelSummary,
  RuntimeModelSchemaRecord,
} from '../../domains/record/types/record';
import { db, ensureDatabaseReady } from '../db/dexie';

interface SaveSchemaOptions {
  source?: LocalSchemaRecordSource;
}

interface DeleteSchemaOptions {
  source?: ModelSource;
  title?: string;
  subtitle?: string;
  description?: string;
}

function toRecord(
  schema: CmsModelSchema,
  existing?: RuntimeModelSchemaRecord,
  options: SaveSchemaOptions = {},
): RuntimeModelSchemaRecord {
  const normalized = normalizeSchema(schema as never) as unknown as CmsModelSchema;
  const modelName = normalized['x-model']?.name ?? 'unknown';
  const now = dayjs().toISOString();

  return {
    id: modelName,
    modelName,
    title: normalized['x-model']?.title ?? normalized.title ?? modelName,
    subtitle: normalized['x-model']?.subtitle,
    description: normalized['x-model']?.description ?? normalized.description,
    schema: normalized,
    source: options.source ?? existing?.source ?? 'runtime',
    deleted: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function toDeletedRecord(
  modelName: string,
  existing?: RuntimeModelSchemaRecord,
  options: DeleteSchemaOptions = {},
): RuntimeModelSchemaRecord {
  const now = dayjs().toISOString();

  return {
    id: modelName,
    modelName,
    title: options.title ?? existing?.title ?? modelName,
    subtitle: options.subtitle ?? existing?.subtitle,
    description: options.description ?? existing?.description,
    source: options.source === 'static' ? 'static-override' : existing?.source ?? 'runtime',
    deleted: true,
    schema: undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export class DexieSchemaService {
  async listRecords(): Promise<RuntimeModelSchemaRecord[]> {
    await ensureDatabaseReady();
    return db.modelSchemas.orderBy('updatedAt').reverse().toArray();
  }

  async getRecord(modelName: string): Promise<RuntimeModelSchemaRecord | undefined> {
    await ensureDatabaseReady();
    return db.modelSchemas.get(modelName);
  }

  async listSummaries(): Promise<ModelSummary[]> {
    const rows = await this.listRecords();
    return rows
      .filter((item) => !item.deleted && item.schema)
      .map((item) => ({
      name: item.modelName,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      source: 'runtime',
      updatedAt: item.updatedAt,
      fieldCount: Object.keys(item.schema?.properties ?? {}).length,
      }));
  }

  async get(modelName: string): Promise<CmsModelSchema | undefined> {
    const row = await this.getRecord(modelName);
    if (!row || row.deleted || !row.schema) {
      return undefined;
    }

    return normalizeSchema(row.schema as never) as unknown as CmsModelSchema;
  }

  async exists(modelName: string): Promise<boolean> {
    const row = await this.getRecord(modelName);
    return Boolean(row && !row.deleted && row.schema);
  }

  async save(schema: CmsModelSchema, options: SaveSchemaOptions = {}): Promise<RuntimeModelSchemaRecord> {
    await ensureDatabaseReady();
    const modelName = schema['x-model']?.name ?? 'unknown';
    const existing = await db.modelSchemas.get(modelName);
    const record = toRecord(schema, existing, options);
    await db.modelSchemas.put(record);
    return record;
  }

  async delete(modelName: string, options: DeleteSchemaOptions = {}): Promise<void> {
    await ensureDatabaseReady();
    await db.transaction('rw', db.modelSchemas, db.modelRecords, async () => {
      if (options.source === 'static') {
        const existing = await db.modelSchemas.get(modelName);
        await db.modelSchemas.put(toDeletedRecord(modelName, existing, options));
      } else {
        await db.modelSchemas.delete(modelName);
      }
      await db.modelRecords.where('modelName').equals(modelName).delete();
    });
  }
}

export const dexieSchemaService = new DexieSchemaService();
