import { conflict, forbidden, notFound } from "../errors.ts";
import { publicRecord, USER_MODEL } from "../domain/visibility.ts";
import { uniqueFields } from "../domain/field-plan.ts";
import { unwrapRefs } from "../store/ref-expander.ts";
import type { ModelRecord, BuilderSchema as ModelSchema, Pagination, Sorter } from "@alien-form/validate";
import type { SchemaStore } from "../store/schema-store.ts";
import type {
  ListResult,
  OptionResult,
  OptionsParams,
  RecordStore,
  SubtreeParams,
} from "../store/record-store.ts";
import type { RefExpander } from "../store/ref-expander.ts";

export interface ListInput {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

export interface OptionsInput extends Partial<OptionsParams> {
  model: string;
}

export interface SubtreeInput extends Partial<SubtreeParams> {
  model: string;
}

/**
 * 记录服务：所有记录操作先按 model 解析 schema（不存在即 404），
 * 再走仓储读写 + 引用展开 + 敏感字段脱敏。写路径统一 unwrapRefs。
 */
export class RecordService {
  constructor(
    private readonly schemas: SchemaStore,
    private readonly records: RecordStore,
    private readonly refs: RefExpander,
  ) {}

  private async requireSchema(model: string): Promise<ModelSchema> {
    const schema = await this.schemas.get(model);
    if (!schema) throw notFound(`未知模型：${model}`);
    return schema;
  }

  async list(input: ListInput): Promise<ListResult> {
    const schema = await this.requireSchema(input.model);
    const result = await this.records.list(schema, {
      filters: unwrapRefs(input.filters),
      pagination: input.pagination,
      sorter: input.sorter,
    });
    const expanded = await this.refs.expand(schema, result.list);
    return { ...result, list: expanded.map((record) => publicRecord(input.model, record)) };
  }

  async options(input: OptionsInput): Promise<OptionResult> {
    const schema = await this.requireSchema(input.model);
    return this.records.options(schema, {
      valueKey: input.valueKey ?? "id",
      labelKey: input.labelKey ?? input.valueKey ?? "id",
      keyword: input.keyword,
      selectedValues: input.selectedValues,
      limit: input.limit,
    });
  }

  async subtree(input: SubtreeInput): Promise<{ list: ModelRecord[] }> {
    const schema = await this.requireSchema(input.model);
    const list = await this.records.subtree(schema, {
      idField: input.idField ?? "id",
      parentField: input.parentField ?? "id",
      parentValue: input.parentValue,
    });
    const expanded = await this.refs.expand(schema, list);
    return { list: expanded.map((record) => publicRecord(input.model, record)) };
  }

  async get(model: string, id: string): Promise<ModelRecord> {
    const schema = await this.requireSchema(model);
    const record = await this.records.get(schema, id);
    if (!record) throw notFound(`记录不存在：${id}`);
    return publicRecord(model, await this.refs.expandOne(schema, record));
  }

  async create(model: string, values: Record<string, unknown>): Promise<ModelRecord> {
    const schema = await this.requireSchema(model);
    const clean = unwrapRefs(values)!;
    await this.assertUnique(schema, clean);
    const record = await this.records.create(schema, clean);
    return publicRecord(model, await this.refs.expandOne(schema, record));
  }

  async update(model: string, id: string, values: Record<string, unknown>): Promise<ModelRecord> {
    const schema = await this.requireSchema(model);
    const clean = unwrapRefs(values)!;
    await this.assertUnique(schema, clean, id);
    const record = await this.records.update(schema, id, clean);
    if (!record) throw notFound(`记录不存在：${id}`);
    return publicRecord(model, await this.refs.expandOne(schema, record));
  }

  /**
   * unique 字段写前查重（应用层保证，非 DB 约束）。
   *
   * D1 通用两表下业务字段无独立列、无从建唯一索引；这里对 schema 声明 unique:true
   * 的字段逐个查重，命中即 409。依赖 D1 写入串行化挡住多数并发，严格并发下仍属弱保证。
   * 只校验本次传入的字段（update 只传部分字段时不误伤未变更字段）。
   */
  private async assertUnique(
    schema: ModelSchema,
    values: Record<string, unknown>,
    excludeId?: string,
  ): Promise<void> {
    for (const field of uniqueFields(schema)) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) continue;
      const value = values[field];
      if (await this.records.existsByField(schema, field, value, excludeId)) {
        throw conflict(`${field} 已存在：${String(value)}`);
      }
    }
  }

  async remove(model: string, id: string): Promise<void> {
    const schema = await this.requireSchema(model);
    await this.assertDeletable(schema, [id]);
    await this.records.delete(schema, id);
  }

  async removeMany(model: string, ids: string[]): Promise<void> {
    const schema = await this.requireSchema(model);
    await this.assertDeletable(schema, ids ?? []);
    await this.records.deleteMany(schema, ids ?? []);
  }

  /**
   * 删除守卫：超级管理员（_sys_user.super === true）不可删除。
   * 收口在服务端强制执行，前端按钮 disabled 只是外观，直连 API 仍受此拦截。
   */
  private async assertDeletable(schema: ModelSchema, ids: string[]): Promise<void> {
    if (schema.meta.name !== USER_MODEL || ids.length === 0) return;
    for (const id of ids) {
      const record = await this.records.get(schema, id);
      if (record?.super) throw forbidden("超级管理员不可删除");
    }
  }
}
