import { getDb, transaction } from "./connection.ts";
import { decode, encode } from "./codec.ts";
import { planFields } from "../schema/field-plan.ts";
import type { ColumnPlan, RelationPlan } from "../schema/field-plan.ts";
import { tableName } from "../schema/naming.ts";
import type { ModelRecord, ModelSchema, Pagination, Sorter } from "../schema/types.ts";

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

function nowMs(): number {
  return Date.now();
}

function newId(model: string): string {
  return `${model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function columnPlans(schema: ModelSchema): ColumnPlan[] {
  return planFields(schema).filter((p): p is ColumnPlan => p.kind === "column");
}

function relationPlans(schema: ModelSchema): RelationPlan[] {
  return planFields(schema).filter((p): p is RelationPlan => p.kind === "m2m");
}

function fieldColumn(schema: ModelSchema, field: string): string | undefined {
  if (field === "id") return "id";
  return columnPlans(schema).find((plan) => plan.field === field)?.column;
}

/** 读取一条 m2m 关系的目标 id 数组。 */
function readRelation(plan: RelationPlan, ownerId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT "${plan.targetColumn}" AS v FROM "${plan.through}" WHERE "${plan.ownerColumn}" = ?`,
    )
    .all(ownerId) as Array<{ v: string }>;
  return rows.map((r) => r.v);
}

/** 覆盖式写入一条 m2m 关系（先删后插，在事务内调用）。 */
function writeRelation(plan: RelationPlan, ownerId: string, targetIds: unknown): void {
  const db = getDb();
  db.prepare(`DELETE FROM "${plan.through}" WHERE "${plan.ownerColumn}" = ?`).run(ownerId);
  if (!Array.isArray(targetIds)) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO "${plan.through}" ("${plan.ownerColumn}", "${plan.targetColumn}") VALUES (?, ?)`,
  );
  for (const targetId of targetIds) {
    if (targetId !== undefined && targetId !== null && targetId !== "") {
      insert.run(ownerId, String(targetId));
    }
  }
}

/** DB 行 → 领域记录（列解码 + 关系聚合 + 系统字段）。 */
function rowToRecord(
  schema: ModelSchema,
  row: Record<string, unknown>,
  cols: ColumnPlan[],
  rels: RelationPlan[],
): ModelRecord {
  const id = String(row.id);
  const record: ModelRecord = {
    id,
    createdAt: (row.created_at as number) ?? undefined,
    updatedAt: (row.updated_at as number) ?? undefined,
  };
  for (const plan of cols) {
    record[plan.field] = decode(plan, row[plan.column]);
  }
  for (const plan of rels) {
    record[plan.field] = readRelation(plan, id);
  }
  return record;
}

/**
 * 列表查询：
 *  - filters 仅作用于 filterable 列（其余键忽略），text 模糊匹配、其它精确匹配
 *  - sorter 仅作用于 sortable 列，否则回落到 updated_at DESC
 *  - 分页在 SQL 层完成
 */
export function listRecords(schema: ModelSchema, params: ListParams): ListResult {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const cols = columnPlans(schema);
  const rels = relationPlans(schema);
  const byField = new Map(cols.map((p) => [p.field, p]));

  const where: string[] = [];
  const args: Array<string | number> = [];
  for (const [field, value] of Object.entries(params.filters ?? {})) {
    const plan = byField.get(field);
    if (!plan || !plan.filterable) continue; // 只认 filterable 字段
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      where.push(`"${plan.column}" IN (${value.map(() => "?").join(", ")})`);
      args.push(...value.map((v) => encode(plan, v) as string | number));
    } else if (plan.type === "text") {
      where.push(`"${plan.column}" LIKE ?`);
      args.push(`%${value}%`);
    } else {
      where.push(`"${plan.column}" = ?`);
      args.push(encode(plan, value) as string | number);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM "${table}" ${whereSql}`).get(...args) as {
    c: number;
  };
  const total = totalRow.c;

  // 排序：仅 sortable 列，列名映射后拼接（白名单，无注入）
  let orderSql = `ORDER BY "updated_at" DESC`;
  if (params.sorter) {
    const plan = byField.get(params.sorter.field);
    if (plan?.sortable) {
      const dir = params.sorter.order === "descend" ? "DESC" : "ASC";
      orderSql = `ORDER BY "${plan.column}" ${dir}`;
    }
  }

  const pagination = params.pagination ?? { current: 1, pageSize: 10 };
  const limit = pagination.pageSize;
  const offset = (pagination.current - 1) * pagination.pageSize;

  const rows = db
    .prepare(`SELECT * FROM "${table}" ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
    .all(...args, limit, offset) as Array<Record<string, unknown>>;

  return { list: rows.map((row) => rowToRecord(schema, row, cols, rels)), total };
}

/**
 * 下拉选项查询：返回匹配项的前 N 条，同时批量补回当前已选值。
 * selectedValues 不受关键词和分页影响，避免编辑态回显退化成逐条详情查询。
 */
export function listOptions(
  schema: ModelSchema,
  params: {
    valueKey: string;
    labelKey: string;
    keyword?: string;
    selectedValues?: unknown[];
    limit?: number;
  },
): OptionResult {
  const valueColumn = fieldColumn(schema, params.valueKey);
  const labelColumn = fieldColumn(schema, params.labelKey);
  if (!valueColumn || !labelColumn) {
    throw new Error(`选项字段不存在：${params.valueKey} / ${params.labelKey}`);
  }

  const db = getDb();
  const table = tableName(schema.meta.name);
  const keyword = params.keyword?.trim();
  const where = keyword ? `WHERE "${labelColumn}" LIKE ?` : "";
  const args = keyword ? [`%${keyword}%`] : [];
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM "${table}" ${where}`).get(...args) as {
    c: number;
  };
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
  const matching = db
    .prepare(
      `SELECT "${valueColumn}" AS value, "${labelColumn}" AS label FROM "${table}" ${where} ` +
        `ORDER BY "${labelColumn}" COLLATE NOCASE ASC LIMIT ?`,
    )
    .all(...args, limit) as Array<{ value: string | number; label: unknown }>;

  const selected = [
    ...new Set(
      (params.selectedValues ?? []).filter(
        (value): value is string | number => typeof value === "string" || typeof value === "number",
      ),
    ),
  ];
  const selectedRows =
    selected.length === 0
      ? []
      : (db
          .prepare(
            `SELECT "${valueColumn}" AS value, "${labelColumn}" AS label FROM "${table}" ` +
              `WHERE "${valueColumn}" IN (${selected.map(() => "?").join(", ")})`,
          )
          .all(...selected) as Array<{ value: string | number; label: unknown }>);

  const options = new Map<string, { value: string | number; label: string }>();
  for (const row of [...selectedRows, ...matching]) {
    options.set(`${typeof row.value}:${row.value}`, {
      value: row.value,
      label: String(row.label ?? row.value),
    });
  }
  return { options: [...options.values()], total: totalRow.c };
}

/**
 * 子树查询：按业务字段 idField / parentField 收集 parentValue 之下的全部后代（任意层级）。
 * parentValue 为空时返回整棵树（全量记录）。供 treelayout 的 query.subtree service 使用。
 */
export function listSubtree(
  schema: ModelSchema,
  params: { idField: string; parentField: string; parentValue?: string | null },
): ModelRecord[] {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const cols = columnPlans(schema);
  const rels = relationPlans(schema);
  const rows = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
  const records = rows.map((row) => rowToRecord(schema, row, cols, rels));

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

export function getRecord(schema: ModelSchema, id: string): ModelRecord | undefined {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const row = db.prepare(`SELECT * FROM "${table}" WHERE "id" = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return rowToRecord(schema, row, columnPlans(schema), relationPlans(schema));
}

/** 按一个标量字段精确查询单条记录，供登录等模型内查找场景复用。 */
export function findRecordByField(
  schema: ModelSchema,
  field: string,
  value: string | number,
): ModelRecord | undefined {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const cols = columnPlans(schema);
  const plan = cols.find((item) => item.field === field);
  if (!plan) return undefined;
  const row = db
    .prepare(`SELECT * FROM "${table}" WHERE "${plan.column}" = ? LIMIT 1`)
    .get(value) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToRecord(schema, row, cols, relationPlans(schema));
}

/**
 * 新建记录：主表 + 各 junction 表在同一事务内写入。
 * 幂等：允许调用方传入 id，命中已存在则走 upsert（ON CONFLICT），避免重复提交产生多条。
 */
export function createRecord(schema: ModelSchema, values: Record<string, unknown>): ModelRecord {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const cols = columnPlans(schema);
  const rels = relationPlans(schema);
  const providedId = typeof values.id === "string" && values.id ? values.id : undefined;
  const id = providedId ?? newId(schema.meta.name);
  const ts = nowMs();

  transaction(() => {
    const columnNames = ["id", "created_at", "updated_at", ...cols.map((p) => `"${p.column}"`)];
    const placeholders = columnNames.map(() => "?");
    const bind: Array<string | number | null> = [id, ts, ts];
    for (const plan of cols) bind.push(encode(plan, values[plan.field]));

    // providedId 命中已存在时更新（幂等），否则插入
    const updates = cols.map((p) => `"${p.column}" = excluded."${p.column}"`).join(", ");
    db.prepare(
      `INSERT INTO "${table}" (id, created_at, updated_at, ${cols
        .map((p) => `"${p.column}"`)
        .join(", ")}) VALUES (${placeholders.join(", ")}) ` +
        `ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at${updates ? ", " + updates : ""}`,
    ).run(...bind);

    for (const plan of rels) writeRelation(plan, id, values[plan.field]);
  });

  return getRecord(schema, id)!;
}

/** 更新记录：主表字段 + 关系整体覆盖，事务包裹。仅更新传入的列，未传入的保持不变。 */
export function updateRecord(
  schema: ModelSchema,
  id: string,
  values: Record<string, unknown>,
): ModelRecord | undefined {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const cols = columnPlans(schema);
  const rels = relationPlans(schema);

  const existing = db.prepare(`SELECT id FROM "${table}" WHERE "id" = ?`).get(id);
  if (!existing) return undefined;

  transaction(() => {
    const sets: string[] = [`"updated_at" = ?`];
    const bind: Array<string | number | null> = [nowMs()];
    for (const plan of cols) {
      if (Object.prototype.hasOwnProperty.call(values, plan.field)) {
        sets.push(`"${plan.column}" = ?`);
        bind.push(encode(plan, values[plan.field]));
      }
    }
    db.prepare(`UPDATE "${table}" SET ${sets.join(", ")} WHERE "id" = ?`).run(...bind, id);

    for (const plan of rels) {
      if (Object.prototype.hasOwnProperty.call(values, plan.field)) {
        writeRelation(plan, id, values[plan.field]);
      }
    }
  });

  return getRecord(schema, id);
}

/** 删除单条：主表 + 关系。幂等（不存在也不报错）。 */
export function deleteRecord(schema: ModelSchema, id: string): void {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const rels = relationPlans(schema);
  transaction(() => {
    for (const plan of rels) {
      db.prepare(`DELETE FROM "${plan.through}" WHERE "${plan.ownerColumn}" = ?`).run(id);
    }
    db.prepare(`DELETE FROM "${table}" WHERE "id" = ?`).run(id);
  });
}

/** 批量删除：单事务。 */
export function deleteRecords(schema: ModelSchema, ids: string[]): void {
  transaction(() => {
    const db = getDb();
    const table = tableName(schema.meta.name);
    const rels = relationPlans(schema);
    for (const id of ids) {
      for (const plan of rels) {
        db.prepare(`DELETE FROM "${plan.through}" WHERE "${plan.ownerColumn}" = ?`).run(id);
      }
      db.prepare(`DELETE FROM "${table}" WHERE "id" = ?`).run(id);
    }
  });
}
