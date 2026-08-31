import type {
  ColumnPlan,
  RelationPlan,
  FieldPlan,
} from "../../../alien-server/src/schema/field-plan.ts";
import { planFields } from "../../../alien-server/src/schema/field-plan.ts";
import type {
  ModelRecord,
  ModelSchema,
  Pagination,
  Sorter,
} from "../../../alien-server/src/schema/types.ts";

export interface ListParams {
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

export interface ListResult {
  list: ModelRecord[];
  total: number;
}

export interface OptionResult {
  options: Array<{ value: string | number; label: string }>;
  total: number;
}

/** records 表的一行：系统列 + data_content JSON。 */
interface RecordRow {
  id: string;
  created_at: number;
  updated_at: number;
  data_content: string;
}

function nowMs(): number {
  return Date.now();
}

function newId(model: string): string {
  return `${model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function columnPlans(schema: ModelSchema): ColumnPlan[] {
  return planFields(schema).filter((p): p is ColumnPlan => p.kind === "column");
}

function fieldPlan(schema: ModelSchema, field: string): FieldPlan | undefined {
  return planFields(schema).find((p) => p.field === field);
}

/**
 * 字段 → 可用于 WHERE / ORDER BY 的 SQL 表达式。
 *  - 系统字段（id / createdAt / updatedAt）直取物理列；
 *  - 其余业务字段一律从 data_content JSON 里 json_extract 取值。
 */
function fieldExpr(field: string): string {
  if (field === "id") return `"id"`;
  if (field === "createdAt") return `"created_at"`;
  if (field === "updatedAt") return `"updated_at"`;
  return `json_extract(data_content, '$.${field}')`;
}

/** 过滤 / 排序取值编码：布尔转 1/0 与 json_extract 的返回对齐，其余原样。 */
function encodeFilterValue(plan: ColumnPlan | undefined, value: unknown): string | number {
  if (plan?.type === "boolean") return value ? 1 : 0;
  if (plan && (plan.type === "real" || plan.type === "integer")) {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : (value as string | number);
  }
  return value as string | number;
}

/** DB 行 → 领域记录：data_content 展开为业务字段 + 系统字段。 */
function rowToRecord(row: RecordRow): ModelRecord {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(row.data_content) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return {
    ...data,
    id: String(row.id),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/**
 * 列表查询（对齐 Node 版语义）：
 *  - filters 仅作用于 filterable 字段；text 模糊、数组 IN、其余精确。
 *  - sorter 仅作用于 sortable 字段，否则回落 updated_at DESC。
 *  - 分页在 SQL 层完成。
 */
export async function listRecords(
  db: D1Database,
  schema: ModelSchema,
  params: ListParams,
): Promise<ListResult> {
  const model = schema.meta.name;
  const byField = new Map(columnPlans(schema).map((p) => [p.field, p]));

  const where: string[] = [`"model" = ?`];
  const args: Array<string | number> = [model];

  for (const [field, value] of Object.entries(params.filters ?? {})) {
    const plan = byField.get(field);
    if (!plan || !plan.filterable) continue; // 只认 filterable 字段
    if (value === undefined || value === null || value === "") continue;
    const expr = fieldExpr(field);
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      where.push(`${expr} IN (${value.map(() => "?").join(", ")})`);
      args.push(...value.map((v) => encodeFilterValue(plan, v)));
    } else if (plan.type === "text") {
      where.push(`${expr} LIKE ?`);
      args.push(`%${value}%`);
    } else {
      where.push(`${expr} = ?`);
      args.push(encodeFilterValue(plan, value));
    }
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM "records" ${whereSql}`)
    .bind(...args)
    .first<{ c: number }>();
  const total = totalRow?.c ?? 0;

  // 排序：仅 sortable 列，白名单表达式拼接（无注入）
  let orderSql = `ORDER BY "updated_at" DESC`;
  if (params.sorter) {
    const plan = byField.get(params.sorter.field);
    if (plan?.sortable) {
      const dir = params.sorter.order === "descend" ? "DESC" : "ASC";
      orderSql = `ORDER BY ${fieldExpr(params.sorter.field)} ${dir}`;
    }
  }

  const pagination = params.pagination ?? { current: 1, pageSize: 10 };
  const limit = pagination.pageSize;
  const offset = (pagination.current - 1) * pagination.pageSize;

  const { results } = await db
    .prepare(`SELECT * FROM "records" ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
    .bind(...args, limit, offset)
    .all<RecordRow>();

  return { list: results.map(rowToRecord), total };
}

/**
 * 下拉选项查询：返回匹配项前 N 条 + 批量补回已选值。
 * value / label 允许是系统字段或业务字段（走 json_extract）。
 */
export async function listOptions(
  db: D1Database,
  schema: ModelSchema,
  params: {
    valueKey: string;
    labelKey: string;
    keyword?: string;
    selectedValues?: unknown[];
    limit?: number;
  },
): Promise<OptionResult> {
  const model = schema.meta.name;
  const valueExpr = fieldExpr(params.valueKey);
  const labelExpr = fieldExpr(params.labelKey);
  const keyword = params.keyword?.trim();

  const baseWhere = `"model" = ?`;
  const where = keyword ? `${baseWhere} AND ${labelExpr} LIKE ?` : baseWhere;
  const args: Array<string | number> = keyword ? [model, `%${keyword}%`] : [model];

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM "records" WHERE ${where}`)
    .bind(...args)
    .first<{ c: number }>();
  const total = totalRow?.c ?? 0;

  const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
  const { results: matching } = await db
    .prepare(
      `SELECT ${valueExpr} AS value, ${labelExpr} AS label FROM "records" WHERE ${where} ` +
        `ORDER BY ${labelExpr} COLLATE NOCASE ASC LIMIT ?`,
    )
    .bind(...args, limit)
    .all<{ value: string | number; label: unknown }>();

  const selected = [
    ...new Set(
      (params.selectedValues ?? []).filter(
        (value): value is string | number => typeof value === "string" || typeof value === "number",
      ),
    ),
  ];
  let selectedRows: Array<{ value: string | number; label: unknown }> = [];
  if (selected.length > 0) {
    const { results } = await db
      .prepare(
        `SELECT ${valueExpr} AS value, ${labelExpr} AS label FROM "records" ` +
          `WHERE "model" = ? AND ${valueExpr} IN (${selected.map(() => "?").join(", ")})`,
      )
      .bind(model, ...selected)
      .all<{ value: string | number; label: unknown }>();
    selectedRows = results;
  }

  const options = new Map<string, { value: string | number; label: string }>();
  for (const row of [...selectedRows, ...matching]) {
    options.set(`${typeof row.value}:${row.value}`, {
      value: row.value,
      label: String(row.label ?? row.value),
    });
  }
  return { options: [...options.values()], total };
}

/**
 * 子树查询：按业务字段 idField / parentField 收集 parentValue 之下的全部后代。
 * parentValue 为空返回整棵树（全量记录）。
 */
export async function listSubtree(
  db: D1Database,
  schema: ModelSchema,
  params: { idField: string; parentField: string; parentValue?: string | null },
): Promise<ModelRecord[]> {
  const { results } = await db
    .prepare(`SELECT * FROM "records" WHERE "model" = ?`)
    .bind(schema.meta.name)
    .all<RecordRow>();
  const records = results.map(rowToRecord);

  const childrenOf = new Map<string, ModelRecord[]>();
  for (const record of records) {
    const raw = record[params.parentField];
    const parent = raw === undefined || raw === null ? "" : String(raw);
    const arr = childrenOf.get(parent) ?? [];
    arr.push(record);
    childrenOf.set(parent, arr);
  }

  const root =
    params.parentValue === undefined || params.parentValue === null
      ? ""
      : String(params.parentValue);
  if (root === "") return records;

  const result: ModelRecord[] = [];
  const queue = [root];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const kids = childrenOf.get(current) ?? [];
    result.push(...kids);
    for (const kid of kids) {
      const id = kid[params.idField];
      if (id !== undefined && id !== null) queue.push(String(id));
    }
  }
  return result;
}

export async function getRecord(
  db: D1Database,
  schema: ModelSchema,
  id: string,
): Promise<ModelRecord | undefined> {
  const row = await db
    .prepare(`SELECT * FROM "records" WHERE "model" = ? AND "id" = ?`)
    .bind(schema.meta.name, id)
    .first<RecordRow>();
  return row ? rowToRecord(row) : undefined;
}

/** 按一个业务字段精确查询单条记录（供登录等场景复用）。 */
export async function findRecordByField(
  db: D1Database,
  schema: ModelSchema,
  field: string,
  value: string | number,
): Promise<ModelRecord | undefined> {
  const plan = fieldPlan(schema, field);
  if (!plan || plan.kind !== "column") return undefined;
  const row = await db
    .prepare(
      `SELECT * FROM "records" WHERE "model" = ? AND ${fieldExpr(field)} = ? LIMIT 1`,
    )
    .bind(schema.meta.name, encodeFilterValue(plan, value))
    .first<RecordRow>();
  return row ? rowToRecord(row) : undefined;
}

/** 把领域值拆成 { 系统字段, data_content }：系统字段单独成列，其余进 JSON。 */
function splitSystemFields(values: Record<string, unknown>): {
  id?: string;
  data: Record<string, unknown>;
} {
  const { id, createdAt: _c, updatedAt: _u, ...rest } = values;
  return {
    id: typeof id === "string" && id ? id : undefined,
    data: rest,
  };
}

/**
 * 新建记录：幂等 upsert（允许传入 id，命中则整体覆盖 data_content）。
 * D1 单表写入天然原子，无需显式事务。
 */
export async function createRecord(
  db: D1Database,
  schema: ModelSchema,
  values: Record<string, unknown>,
): Promise<ModelRecord> {
  const model = schema.meta.name;
  const { id: providedId, data } = splitSystemFields(values);
  const id = providedId ?? newId(model);
  const ts = nowMs();

  await db
    .prepare(
      `INSERT INTO "records" (id, model, created_at, updated_at, data_content) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(model, id) DO UPDATE SET updated_at = excluded.updated_at, data_content = excluded.data_content`,
    )
    .bind(id, model, ts, ts, JSON.stringify(data))
    .run();

  return (await getRecord(db, schema, id))!;
}

/**
 * 更新记录：仅合并传入字段（未传入的 data_content 键保持不变），系统字段忽略。
 */
export async function updateRecord(
  db: D1Database,
  schema: ModelSchema,
  id: string,
  values: Record<string, unknown>,
): Promise<ModelRecord | undefined> {
  const existing = await getRecord(db, schema, id);
  if (!existing) return undefined;

  const { data: incoming } = splitSystemFields(values);
  const { id: _id, createdAt: _c, updatedAt: _u, ...currentData } = existing;
  const merged = { ...currentData, ...incoming };

  await db
    .prepare(`UPDATE "records" SET updated_at = ?, data_content = ? WHERE "model" = ? AND "id" = ?`)
    .bind(nowMs(), JSON.stringify(merged), schema.meta.name, id)
    .run();

  return getRecord(db, schema, id);
}

/** 删除单条（幂等）。 */
export async function deleteRecord(db: D1Database, schema: ModelSchema, id: string): Promise<void> {
  await db
    .prepare(`DELETE FROM "records" WHERE "model" = ? AND "id" = ?`)
    .bind(schema.meta.name, id)
    .run();
}

/** 批量删除：D1 batch 单次往返。 */
export async function deleteRecords(
  db: D1Database,
  schema: ModelSchema,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const stmt = db.prepare(`DELETE FROM "records" WHERE "model" = ? AND "id" = ?`);
  await db.batch(ids.map((id) => stmt.bind(schema.meta.name, id)));
}
