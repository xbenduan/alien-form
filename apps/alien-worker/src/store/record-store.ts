import type {
  ModelFieldSchema,
  ModelRecord,
  ModelSchema,
  Pagination,
  Sorter,
} from "@alien-form/protocol";
import { columnName, fieldExpression, planByField, type FieldPlan } from "../domain/field-plan.ts";
import { formatRecordId } from "../domain/record-id.ts";
import { compileRecordFilter } from "../domain/record-filter.ts";
import { compileStorageManifest } from "../domain/storage-compiler.ts";
import { quoteColumn, quoteTable } from "../domain/sql.ts";

type SqlValue = string | number | null;
type RecordRow = Record<string, unknown> & {
  id: string;
  created_at: number;
  updated_at: number;
  data_content: string;
};

export interface ListParams {
  filter?: string;
  authId: string;
  pagination?: Pagination;
  sorter?: Sorter;
  keyword?: string;
  searchFields?: string[];
  parentId?: string | null;
  idField?: string;
  parentField?: string;
}

export interface ListResult {
  list: ModelRecord[];
  total: number;
}

export interface OptionResult {
  options: Array<{ value: string | number; label: string }>;
  total: number;
}

export interface OptionsParams {
  valueKey: string;
  labelKey: string;
  keyword?: string;
  selectedValues?: unknown[];
  limit?: number;
}

export interface SubtreeParams {
  idField: string;
  parentField: string;
  parentValue?: string | null;
}

function decodePhysical(field: ModelFieldSchema, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (field.database?.type === "boolean") return value === 1 || value === true;
  if (field.database?.type === "json" && typeof value === "string") return JSON.parse(value);
  return value;
}

function encodePhysical(field: ModelFieldSchema, value: unknown): SqlValue {
  if (value === undefined || value === null || value === "") return null;
  const type = field.database?.type;
  if (type === "boolean") return value ? 1 : 0;
  if (type === "integer" || type === "real") {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) throw new Error(`字段 ${field.key} 必须为数字`);
    return number;
  }
  if (type === "date") {
    const timestamp = typeof value === "number" ? value : Date.parse(String(value));
    if (!Number.isFinite(timestamp)) throw new Error(`字段 ${field.key} 必须为有效日期`);
    return timestamp;
  }
  if (type === "json") return JSON.stringify(value);
  return String(value);
}

function rowToRecord(schema: ModelSchema, row: RecordRow): ModelRecord {
  const data = JSON.parse(row.data_content) as Record<string, unknown>;
  const record: ModelRecord = {
    ...data,
    id: String(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const field of schema.fields) {
    if (
      field.storage !== "physical" ||
      field.relation?.kind === "many-to-many" ||
      field.key === "id" ||
      field.key === "createdAt" ||
      field.key === "updatedAt"
    ) {
      continue;
    }
    record[field.key] = decodePhysical(field, row[columnName(field)]);
  }
  return record;
}

function relationValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item) =>
        typeof item === "string" || typeof item === "number" ? [String(item)] : [],
      ),
    ),
  ];
}

export class RecordStore {
  constructor(private readonly db: D1Database) {}

  async allocateId(): Promise<string> {
    const row = await this.db
      .prepare(
        `INSERT INTO "_sequences" (name, next) VALUES ('__global__', 1)
         ON CONFLICT(name) DO UPDATE SET next = next + 1
         RETURNING next`,
      )
      .first<{ next: number }>();
    if (!row) throw new Error("记录 ID 分配失败");
    return formatRecordId(row.next);
  }

  private async attachManyRelations(
    schema: ModelSchema,
    records: ModelRecord[],
  ): Promise<ModelRecord[]> {
    if (records.length === 0) return records;
    const ids = records.map((record) => String(record.id));
    const byId = new Map(records.map((record) => [String(record.id), record]));
    const relations = compileStorageManifest(schema).relations;

    for (const relation of relations) {
      const { results } = await this.db
        .prepare(
          `SELECT "source_id", "target_value" FROM ${quoteTable(relation.table)}
           WHERE "source_id" IN (${ids.map(() => "?").join(", ")})
           ORDER BY "source_id", "target_value"`,
        )
        .bind(...ids)
        .all<{ source_id: string; target_value: string }>();
      for (const record of records) record[relation.field] = [];
      for (const row of results) {
        const record = byId.get(row.source_id);
        if (record) (record[relation.field] as string[]).push(row.target_value);
      }
    }
    return records;
  }

  async list(schema: ModelSchema, params: ListParams): Promise<ListResult> {
    const table = quoteTable(schema.name);
    const fields = planByField(schema);
    const where: string[] = [];
    const args: SqlValue[] = [];

    if (params.parentId !== undefined && params.parentId !== null && params.parentId !== "") {
      const idField = params.idField ?? "id";
      const parentField = params.parentField;
      if (!parentField) throw new Error("parentId 查询缺少模型自关联字段");
      const descendants = await this.subtree(schema, {
        idField,
        parentField,
        parentValue: params.parentId,
      });
      const ids = [
        String(params.parentId),
        ...descendants.flatMap((record) => {
          const value = record[idField];
          return value === undefined || value === null || value === "" ? [] : [String(value)];
        }),
      ];
      const values = [...new Set(ids)];
      const idPlan = fields.get(idField);
      if (!idPlan) throw new Error(`未知树 ID 字段：${idField}`);
      where.push(`${fieldExpression(idPlan)} IN (${values.map(() => "?").join(", ")})`);
      args.push(...values);
    }

    const compiledFilter = compileRecordFilter(params.filter, {
      authId: params.authId,
      fields,
    });
    if (compiledFilter) {
      where.push(compiledFilter.sql);
      args.push(...compiledFilter.args);
    }

    const keyword = params.keyword?.trim();
    if (keyword && params.searchFields?.length) {
      const searchable = [...new Set(params.searchFields)]
        .map((key) => fields.get(key))
        .filter((plan): plan is FieldPlan => plan !== undefined && !plan.json);
      if (searchable.length > 0) {
        where.push(
          `(${searchable
            .map((plan) => `CAST(${fieldExpression(plan)} AS TEXT) LIKE ?`)
            .join(" OR ")})`,
        );
        args.push(...searchable.map(() => `%${keyword}%`));
      }
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    let orderSql = `ORDER BY "updated_at" DESC`;
    if (params.sorter) {
      const plan = fields.get(params.sorter.field);
      if (plan?.sortable) {
        const direction = params.sorter.order === "descend" ? "DESC" : "ASC";
        orderSql = `ORDER BY ${fieldExpression(plan)} ${direction}`;
      }
    }

    const pagination = params.pagination ?? { current: 1, pageSize: 10 };
    const limit = pagination.pageSize;
    const offset = (pagination.current - 1) * pagination.pageSize;
    const [countResult, dataResult] = await this.db.batch([
      this.db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${whereSql}`).bind(...args),
      this.db
        .prepare(`SELECT * FROM ${table} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
        .bind(...args, limit, offset),
    ]);
    const countRow = countResult.results[0] as { c?: number } | undefined;
    const records = dataResult.results.map((row) => rowToRecord(schema, row as RecordRow));
    await this.attachManyRelations(schema, records);
    return { list: records, total: countRow?.c ?? 0 };
  }

  async options(schema: ModelSchema, params: OptionsParams): Promise<OptionResult> {
    const fields = planByField(schema);
    const valuePlan = fields.get(params.valueKey);
    const labelPlan = fields.get(params.labelKey);
    if (!valuePlan || !labelPlan) throw new Error("选项字段不存在或不支持查询");
    const valueExpr = fieldExpression(valuePlan);
    const labelExpr = fieldExpression(labelPlan);
    const keyword = params.keyword?.trim();
    const where = keyword ? `${labelExpr} LIKE ?` : "1 = 1";
    const args: SqlValue[] = keyword ? [`%${keyword}%`] : [];
    const table = quoteTable(schema.name);
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);

    const [countResult, matchResult] = await this.db.batch([
      this.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).bind(...args),
      this.db
        .prepare(
          `SELECT ${valueExpr} AS value, ${labelExpr} AS label FROM ${table}
           WHERE ${where} ORDER BY ${labelExpr} COLLATE NOCASE ASC LIMIT ?`,
        )
        .bind(...args, limit),
    ]);
    const selected = [
      ...new Set(
        (params.selectedValues ?? []).filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        ),
      ),
    ];
    let selectedRows: Array<{ value: string | number; label: unknown }> = [];
    if (selected.length > 0) {
      const result = await this.db
        .prepare(
          `SELECT ${valueExpr} AS value, ${labelExpr} AS label FROM ${table}
           WHERE ${valueExpr} IN (${selected.map(() => "?").join(", ")})`,
        )
        .bind(...selected)
        .all<{ value: string | number; label: unknown }>();
      selectedRows = result.results;
    }

    const options = new Map<string, { value: string | number; label: string }>();
    const matching = matchResult.results as Array<{ value: string | number; label: unknown }>;
    for (const row of [...selectedRows, ...matching]) {
      options.set(`${typeof row.value}:${row.value}`, {
        value: row.value,
        label: String(row.label ?? row.value),
      });
    }
    const countRow = countResult.results[0] as { c?: number } | undefined;
    return { options: [...options.values()], total: countRow?.c ?? 0 };
  }

  async subtree(schema: ModelSchema, params: SubtreeParams): Promise<ModelRecord[]> {
    const result = await this.db.prepare(`SELECT * FROM ${quoteTable(schema.name)}`).all();
    const records = result.results.map((row) => rowToRecord(schema, row as RecordRow));
    const childrenOf = new Map<string, ModelRecord[]>();
    for (const record of records) {
      const raw = record[params.parentField];
      const parent = raw === undefined || raw === null ? "" : String(raw);
      const children = childrenOf.get(parent) ?? [];
      children.push(record);
      childrenOf.set(parent, children);
    }
    const root =
      params.parentValue === undefined || params.parentValue === null
        ? ""
        : String(params.parentValue);
    if (root === "") return this.attachManyRelations(schema, records);

    const output: ModelRecord[] = [];
    const queue = [root];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const children = childrenOf.get(current) ?? [];
      output.push(...children);
      for (const child of children) {
        const id = child[params.idField];
        if (id !== undefined && id !== null) queue.push(String(id));
      }
    }
    return this.attachManyRelations(schema, output);
  }

  async get(schema: ModelSchema, id: string): Promise<ModelRecord | undefined> {
    const row = await this.db
      .prepare(`SELECT * FROM ${quoteTable(schema.name)} WHERE "id" = ?`)
      .bind(id)
      .first<RecordRow>();
    if (!row) return undefined;
    return (await this.attachManyRelations(schema, [rowToRecord(schema, row)]))[0];
  }

  async findByField(
    schema: ModelSchema,
    field: string,
    value: string | number,
  ): Promise<ModelRecord | undefined> {
    const plan = planByField(schema).get(field);
    if (!plan) return undefined;
    const row = await this.db
      .prepare(
        `SELECT * FROM ${quoteTable(schema.name)}
         WHERE ${fieldExpression(plan)} = ? LIMIT 1`,
      )
      .bind(encodeQueryValue(plan, value))
      .first<RecordRow>();
    if (!row) return undefined;
    return (await this.attachManyRelations(schema, [rowToRecord(schema, row)]))[0];
  }

  async create(schema: ModelSchema, values: Record<string, unknown>): Promise<ModelRecord> {
    const id = typeof values.id === "string" && values.id ? values.id : await this.allocateId();
    const timestamp = Date.now();
    const { columns, args, virtual, many } = splitRecord(schema, { ...values, id });
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO ${quoteTable(schema.name)}
           (${["id", "created_at", "updated_at", "data_content", ...columns]
             .map(quoteColumn)
             .join(", ")})
           VALUES (${Array.from({ length: columns.length + 4 }, () => "?").join(", ")})`,
        )
        .bind(id, timestamp, timestamp, JSON.stringify(virtual), ...args),
      ...relationStatements(this.db, schema, id, many),
    ];
    await this.db.batch(statements);
    const record = await this.get(schema, id);
    if (!record) throw new Error(`记录创建后无法读取：${id}`);
    return record;
  }

  async update(
    schema: ModelSchema,
    id: string,
    values: Record<string, unknown>,
  ): Promise<ModelRecord | undefined> {
    if (!(await this.get(schema, id))) return undefined;
    const { columns, args, virtual, many } = splitRecord(schema, { ...values, id });
    const assignments = [
      `"updated_at" = ?`,
      `"data_content" = ?`,
      ...columns.map((column) => `${quoteColumn(column)} = ?`),
    ];
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(`UPDATE ${quoteTable(schema.name)} SET ${assignments.join(", ")} WHERE "id" = ?`)
        .bind(Date.now(), JSON.stringify(virtual), ...args, id),
      ...relationStatements(this.db, schema, id, many),
    ];
    await this.db.batch(statements);
    return this.get(schema, id);
  }

  async delete(schema: ModelSchema, id: string): Promise<void> {
    const statements = compileStorageManifest(schema).relations.map((relation) =>
      this.db.prepare(`DELETE FROM ${quoteTable(relation.table)} WHERE "source_id" = ?`).bind(id),
    );
    statements.push(
      this.db.prepare(`DELETE FROM ${quoteTable(schema.name)} WHERE "id" = ?`).bind(id),
    );
    await this.db.batch(statements);
  }

  async deleteMany(schema: ModelSchema, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const statements: D1PreparedStatement[] = [];
    for (const id of ids) {
      for (const relation of compileStorageManifest(schema).relations) {
        statements.push(
          this.db
            .prepare(`DELETE FROM ${quoteTable(relation.table)} WHERE "source_id" = ?`)
            .bind(id),
        );
      }
      statements.push(
        this.db.prepare(`DELETE FROM ${quoteTable(schema.name)} WHERE "id" = ?`).bind(id),
      );
    }
    await this.db.batch(statements);
  }
}

function encodeQueryValue(plan: FieldPlan, value: string | number): string | number {
  if (plan.type === "boolean") return value ? 1 : 0;
  if (plan.type === "integer" || plan.type === "real" || plan.type === "date") {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function splitRecord(
  schema: ModelSchema,
  values: Record<string, unknown>,
): {
  columns: string[];
  args: SqlValue[];
  virtual: Record<string, unknown>;
  many: Map<string, string[]>;
} {
  const known = new Set(schema.fields.map((field) => field.key));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) throw new Error(`未知字段：${key}`);
  }

  const columns: string[] = [];
  const args: SqlValue[] = [];
  const virtual: Record<string, unknown> = {};
  const many = new Map<string, string[]>();

  for (const field of schema.fields) {
    if (field.key === "id" || field.key === "createdAt" || field.key === "updatedAt") continue;
    const value = values[field.key];
    if (field.storage === "physical" && field.relation?.kind === "many-to-many") {
      many.set(field.key, relationValues(value));
    } else if (field.storage === "physical") {
      columns.push(columnName(field));
      args.push(encodePhysical(field, value));
    } else if (value !== undefined) {
      virtual[field.key] = value;
    }
  }
  return { columns, args, virtual, many };
}

function relationStatements(
  db: D1Database,
  schema: ModelSchema,
  id: string,
  values: Map<string, string[]>,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const relation of compileStorageManifest(schema).relations) {
    statements.push(
      db.prepare(`DELETE FROM ${quoteTable(relation.table)} WHERE "source_id" = ?`).bind(id),
    );
    for (const value of values.get(relation.field) ?? []) {
      statements.push(
        db
          .prepare(
            `INSERT INTO ${quoteTable(relation.table)} ("source_id", "target_value")
             VALUES (?, ?)`,
          )
          .bind(id, value),
      );
    }
  }
  return statements;
}
