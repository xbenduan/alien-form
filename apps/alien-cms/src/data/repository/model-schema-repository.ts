import dayjs from 'dayjs';
import { normalizeSchema } from '@alien-form/cms';
import type { CmsModelSchema, ModelSummary, RuntimeModelSchemaRecord } from '../../types/model';
import { db, ensureDatabaseReady } from '../db/dexie';

function toRecord(schema: CmsModelSchema, existing?: RuntimeModelSchemaRecord): RuntimeModelSchemaRecord {
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
    source: 'runtime',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export class ModelSchemaRepository {
  async list(): Promise<RuntimeModelSchemaRecord[]> {
    await ensureDatabaseReady();
    return db.modelSchemas.orderBy('updatedAt').reverse().toArray();
  }

  async listSummaries(): Promise<ModelSummary[]> {
    const rows = await this.list();
    return rows.map((item) => ({
      name: item.modelName,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      source: 'runtime',
    }));
  }

  async get(modelName: string): Promise<CmsModelSchema | undefined> {
    await ensureDatabaseReady();
    const row = await db.modelSchemas.get(modelName);
    return row ? (normalizeSchema(row.schema as never) as unknown as CmsModelSchema) : undefined;
  }

  async exists(modelName: string): Promise<boolean> {
    await ensureDatabaseReady();
    return Boolean(await db.modelSchemas.get(modelName));
  }

  async save(schema: CmsModelSchema): Promise<RuntimeModelSchemaRecord> {
    await ensureDatabaseReady();
    const modelName = schema['x-model']?.name ?? 'unknown';
    const existing = await db.modelSchemas.get(modelName);
    const record = toRecord(schema, existing);
    await db.modelSchemas.put(record);
    return record;
  }

  async delete(modelName: string): Promise<void> {
    await ensureDatabaseReady();
    await db.transaction('rw', db.modelSchemas, db.modelRecords, async () => {
      await db.modelSchemas.delete(modelName);
      await db.modelRecords.where('modelName').equals(modelName).delete();
    });
  }
}

export const modelSchemaRepository = new ModelSchemaRepository();
