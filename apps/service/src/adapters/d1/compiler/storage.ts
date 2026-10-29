import { pointerSegments } from "formwork/model";
import type { ModelDefinition, StorageBinding } from "formwork/model";
import type { StorageManifest } from "../../../contracts";
import { ServiceError } from "../../../http/errors";

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const reservedColumns = new Set(["id", "created_at", "updated_at", "creator_id", "data_content"]);
/** 引用已经验证的 SQL 标识符，绝不接受记录值作为标识符。 */
export function quote(value: string): string {
  if (!identifier.test(value))
    throw new ServiceError("INVALID_MODEL", `非法 SQL 标识符 ${value}`, 422);
  return `"${value}"`;
}
/** 将可信的 JSON 键和固定文本编码为 SQL 字面量。 */
export function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
/** 读取 binding 对应的根字段名称。 */
export function bindingKey(binding: StorageBinding): string {
  const parts = pointerSegments(binding.path);
  if (parts.length !== 1)
    throw new ServiceError("INVALID_MODEL", "binding.path 必须是根字段 Pointer", 422);
  return parts[0]!;
}
/** 生成字段的数据库表达式；筛选值仍由 prepared statement 绑定。 */
export function bindingExpression(binding: StorageBinding): string {
  return binding.column
    ? quote(binding.column)
    : `json_extract("data_content", ${literal(`$.${JSON.stringify(binding.jsonKey)}`)})`;
}
/** 为模型主表创建 nullable 业务列和服务端身份列。 */
export function createTableSql(table: string, bindings: readonly StorageBinding[]): string {
  return `CREATE TABLE ${quote(table)} (
    "id" TEXT PRIMARY KEY, "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL, "data_content" TEXT NOT NULL DEFAULT '{}'
    ${bindings
      .filter((binding) => binding.column && !reservedColumns.has(binding.column))
      .map((binding) => `, ${quote(binding.column!)} ${binding.sqlType}`)
      .join("")}
  )`;
}
function indexName(table: string, binding: StorageBinding): string {
  // Column names are globally unique within this manifest; UTF-8 ids never enter SQL names.
  const key =
    binding.column ??
    `json_${Array.from(new TextEncoder().encode(binding.jsonKey!))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
  return `fwidx_${table}_${key}`;
}
function storageIssue(path: string, message: string): never {
  throw new ServiceError("STORAGE_INCOMPATIBLE", message, 422, [
    { path, code: "MIGRATION_REQUIRED", message },
  ]);
}
/** 合并实际保留列与当前 bindings，生成保留历史数据的原子 DDL 计划。 */
export async function planStorage(
  db: D1Database,
  definition: ModelDefinition,
  previous?: StorageManifest,
): Promise<{ manifest: StorageManifest; statements: D1PreparedStatement[] }> {
  const { table, bindings } = definition.backend.storage;
  quote(table);
  if (/^(fw_|sqlite_)/iu.test(table) || ["models", "sessions"].includes(table.toLowerCase()))
    storageIssue("/backend/storage/table", "系统 metadata 与认证表不能用作业务存储");
  if (previous && table.toLowerCase() !== previous.table.toLowerCase())
    storageIssue("/backend/storage/table", "修改主表需要显式数据迁移");
  const owner = await db
    .prepare(
      `SELECT id FROM fw_models WHERE storage_table = ? COLLATE NOCASE AND id <> ?
     UNION ALL SELECT source_model_id AS id FROM fw_relation_tables WHERE table_name = ? COLLATE NOCASE`,
    )
    .bind(table, definition.document.id, table)
    .first();
  if (owner) storageIssue("/backend/storage/table", "主表已由其他模型或关系持有");
  const actual = (
    await db.prepare(`PRAGMA table_info(${quote(table)})`).all<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
      dflt_value: string | null;
    }>()
  ).results;
  if (!previous && actual.length)
    storageIssue("/backend/storage/table", "已有物理表必须通过迁移登记所有权");
  const manifest: StorageManifest = {
    table,
    bindings: previous?.bindings.map((binding) => ({ ...binding, active: false })) ?? [],
    relations: previous?.relations.map((relation) => ({ ...relation, active: false })) ?? [],
  };
  for (const [index, binding] of bindings.entries()) {
    const path = `/backend/storage/bindings/${index}`;
    bindingKey(binding);
    if (!!binding.column === !!binding.jsonKey)
      storageIssue(path, "binding 必须且只能选择 column 或 jsonKey");
    const before = manifest.bindings.find((item) => item.id === binding.id);
    if (
      before &&
      (before.column !== binding.column ||
        before.jsonKey !== binding.jsonKey ||
        before.sqlType !== binding.sqlType ||
        before.encoding !== binding.encoding)
    )
      storageIssue(path, `字段 ${binding.id} 的存储类型、编码或位置改变，需要迁移`);
    if (
      binding.column &&
      reservedColumns.has(binding.column) &&
      !(
        {
          id: "id",
          created_at: "createdAt",
          updated_at: "updatedAt",
          creator_id: "creatorId",
        } as Record<string, string>
      )[binding.column]
    )
      storageIssue(path, "不能绑定内部 data_content 列");
    if (
      binding.column &&
      reservedColumns.has(binding.column) &&
      bindingKey(binding) !==
        (
          {
            id: "id",
            created_at: "createdAt",
            updated_at: "updatedAt",
            creator_id: "creatorId",
          } as Record<string, string>
        )[binding.column]
    )
      storageIssue(path, "服务端身份列只能绑定对应的只读字段");
    const occupied = manifest.bindings.find(
      (item) =>
        item.id !== binding.id &&
        (binding.column
          ? item.column?.toLowerCase() === binding.column.toLowerCase()
          : item.jsonKey === binding.jsonKey && !item.column),
    );
    if (occupied) storageIssue(path, `存储位置已属于稳定字段 ${occupied.id}`);
    if (before) Object.assign(before, binding, { active: true });
    else manifest.bindings.push({ ...binding, active: true });
  }
  for (const [index, relation] of definition.backend.relations.entries()) {
    const path = `/backend/relations/${index}`;
    const before = manifest.relations.find((item) => item.fieldId === relation.fieldId);
    const relationTable =
      relation.kind === "many-to-many"
        ? (relation.through ??
          `${table}_rel_${[...new TextEncoder().encode(relation.fieldId)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")}`)
        : undefined;
    if (
      before &&
      (before.kind !== relation.kind ||
        before.targetModel !== relation.targetModel ||
        before.targetFieldId !== relation.targetFieldId ||
        before.table !== relationTable)
    )
      storageIssue(path, "关系基数、目标或 through 表改变，需要迁移");
    if (relationTable) {
      quote(relationTable);
      if (
        /^(fw_|sqlite_)/iu.test(relationTable) ||
        relationTable.toLowerCase() === table.toLowerCase() ||
        ["models", "sessions"].includes(relationTable.toLowerCase())
      )
        storageIssue(path, "through 表名称被保留");
      if (
        manifest.relations.some(
          (item) =>
            item.fieldId !== relation.fieldId &&
            item.table?.toLowerCase() === relationTable.toLowerCase(),
        )
      )
        storageIssue(path, "through 表不能由两个字段共享");
      const relationOwner = await db
        .prepare(
          `SELECT id FROM fw_models WHERE storage_table = ? COLLATE NOCASE
         UNION ALL SELECT source_model_id FROM fw_relation_tables WHERE table_name = ? COLLATE NOCASE
         AND NOT (source_model_id = ? AND field_id = ?)`,
        )
        .bind(relationTable, relationTable, definition.document.id, relation.fieldId)
        .first();
      if (relationOwner) storageIssue(path, "through 表已有其他所有者");
      if (
        !before &&
        (await db
          .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ? COLLATE NOCASE")
          .bind(relationTable)
          .first())
      )
        storageIssue(path, "已有关系表必须通过迁移登记");
    }
    if (before) Object.assign(before, relation, { table: relationTable, active: true });
    else manifest.relations.push({ ...relation, table: relationTable, active: true });
  }
  const statements: D1PreparedStatement[] = [];
  if (!actual.length) statements.push(db.prepare(createTableSql(table, manifest.bindings)));
  else {
    // PRAGMA may contain columns from versions older than the currently active definition.
    const actualNames = new Set(actual.map((column) => column.name.toLowerCase()));
    for (const column of actual) {
      if (
        !reservedColumns.has(column.name) &&
        !manifest.bindings.some(
          (binding) => binding.column?.toLowerCase() === column.name.toLowerCase(),
        )
      )
        manifest.bindings.push({
          id: `physical:${column.name}`,
          path: `/${column.name}`,
          column: column.name,
          sqlType: /INT/iu.test(column.type)
            ? "INTEGER"
            : /REAL|FLOA|DOUB/iu.test(column.type)
              ? "REAL"
              : "TEXT",
          encoding: "scalar",
          active: false,
        });
    }
    if (actual.some((column) => !reservedColumns.has(column.name) && column.notnull)) {
      const indexes = (
        await db
          .prepare(
            "SELECT sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
          )
          .bind(table)
          .all<{ sql: string }>()
      ).results;
      const indexList = (
        await db.prepare(`PRAGMA index_list(${quote(table)})`).all<{
          name: string;
          unique: number;
          origin: string;
        }>()
      ).results;
      for (const [index, item] of indexList.entries()) {
        if (!item.unique || item.origin !== "u") continue;
        const columns = (
          await db.prepare(`PRAGMA index_info(${quote(item.name)})`).all<{ name: string }>()
        ).results;
        indexes.push({
          sql: `CREATE UNIQUE INDEX ${quote(`retained_${table}_${index}`)}
          ON ${quote(table)} (${columns.map((column) => quote(column.name)).join(", ")})`,
        });
      }
      if ((await db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all()).results.length)
        storageIssue("/backend/storage", "遗留表包含外键约束，需要显式迁移后才能放宽 NOT NULL");
      const triggers = await db
        .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ?")
        .bind(table)
        .first();
      if (triggers)
        storageIssue("/backend/storage", "遗留表包含 trigger，需要显式迁移后才能放宽 NOT NULL");
      if (!actualNames.has("id") || actual.filter((column) => column.pk).length !== 1)
        storageIssue("/backend/storage", "遗留表主键不是单一 id，需要显式迁移");
      const temporary = `${table}_shadow_${crypto.randomUUID().replaceAll("-", "")}`;
      const retained = actual.map(
        (column) =>
          `${quote(column.name)} ${column.type || "TEXT"}${column.pk ? " PRIMARY KEY" : ""}${
            reservedColumns.has(column.name) && column.notnull && !column.pk ? " NOT NULL" : ""
          }${column.dflt_value === null ? "" : ` DEFAULT ${column.dflt_value}`}`,
      );
      const added = manifest.bindings.filter(
        (binding) => binding.column && !actualNames.has(binding.column.toLowerCase()),
      );
      statements.push(
        db.prepare(
          `CREATE TABLE ${quote(temporary)} (${retained.concat(added.map((binding) => `${quote(binding.column!)} ${binding.sqlType}`)).join(", ")})`,
        ),
        db.prepare(`INSERT INTO ${quote(temporary)} (${actual.map((column) => quote(column.name)).join(", ")})
          SELECT ${actual.map((column) => quote(column.name)).join(", ")} FROM ${quote(table)}`),
        db.prepare(`DROP TABLE ${quote(table)}`),
        db.prepare(`ALTER TABLE ${quote(temporary)} RENAME TO ${quote(table)}`),
        ...indexes.map((index) => db.prepare(index.sql)),
      );
    } else
      for (const binding of manifest.bindings) {
        if (binding.column && !actualNames.has(binding.column.toLowerCase()))
          statements.push(
            db.prepare(
              `ALTER TABLE ${quote(table)} ADD COLUMN ${quote(binding.column)} ${binding.sqlType}`,
            ),
          );
      }
  }
  for (const binding of previous?.bindings ?? []) {
    if (binding.index)
      statements.push(db.prepare(`DROP INDEX IF EXISTS ${quote(indexName(table, binding))}`));
  }
  for (const binding of bindings) {
    if (binding.index)
      statements.push(
        db.prepare(
          `CREATE ${binding.index === "unique" ? "UNIQUE " : ""}INDEX ${quote(indexName(table, binding))}
       ON ${quote(table)} (${bindingExpression(binding)})`,
        ),
      );
  }
  for (const relation of manifest.relations) {
    if (
      relation.active &&
      relation.table &&
      !previous?.relations.some((before) => before.fieldId === relation.fieldId)
    ) {
      statements.push(
        db.prepare(`CREATE TABLE ${quote(relation.table)} ("source_id" TEXT NOT NULL,
          "target_value" TEXT NOT NULL, PRIMARY KEY("source_id", "target_value"))`),
        db
          .prepare(
            "INSERT INTO fw_relation_tables(source_model_id, field_id, table_name) VALUES (?, ?, ?)",
          )
          .bind(definition.document.id, relation.fieldId, relation.table),
      );
    }
  }
  return { manifest, statements };
}
