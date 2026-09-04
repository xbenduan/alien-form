import { assertBuilderSchema, type BuilderSchema as ModelSchema } from "@alien-form/validate";
import { conflict, notFound } from "../errors.ts";
import type { SchemaEntry, SchemaStore } from "../store/schema-store.ts";

/** 模型列表摘要（列表页用）。 */
export interface ModelSummary {
  fieldCount: number;
  updatedAt: string;
  [key: string]: unknown;
}

/** 模型服务：模型的校验、去重、增删改查编排。 */
export class SchemaService {
  constructor(private readonly schemas: SchemaStore) {}

  async list(): Promise<ModelSummary[]> {
    const entries = await this.schemas.list();
    return entries.map(({ schema, updatedAt }) => ({
      ...schema.meta,
      fieldCount: schema.fields?.length ?? 0,
      updatedAt,
    }));
  }

  async get(name: string): Promise<ModelSchema> {
    const entry = await this.schemas.getEntry(name);
    if (!entry) throw notFound(`模型不存在：${name}`);
    return entry.schema;
  }

  /** 新建模型（同名报错）。 */
  async create(schema: ModelSchema): Promise<SchemaEntry> {
    assertBuilderSchema(schema);
    if (await this.schemas.has(schema.meta.name)) {
      throw conflict(`模型已存在：${schema.meta.name}`);
    }
    return this.schemas.upsert(schema);
  }

  /** 更新模型（以路径 name 覆盖 meta.name）。 */
  async update(name: string, incoming: ModelSchema): Promise<SchemaEntry> {
    if (!(await this.schemas.has(name))) throw notFound(`模型不存在：${name}`);
    const schema: ModelSchema = { ...incoming, meta: { ...incoming.meta, name } };
    assertBuilderSchema(schema);
    return this.schemas.upsert(schema);
  }

  async remove(name: string): Promise<void> {
    await this.schemas.remove(name);
  }
}
