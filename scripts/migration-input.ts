import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { URL } from "node:url";
import type {
  LegacySchema,
  LegacyTable,
  MigrationInventory,
} from "../apps/service/src/migration/types";
import type { ModelDocument } from "../packages/formwork/src/model/types";

function sqlName(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
/** 只读盘点隔离 SQLite/D1 导出副本，补齐历史代码持有的系统协议输入。 */
export async function inventoryDatabase(path: string): Promise<MigrationInventory> {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tableNames = db
      .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const tables: LegacyTable[] = tableNames.map(({ name }) => {
      const indexes = db.prepare(`PRAGMA index_list(${sqlName(name)})`).all() as {
        name: string;
        unique: number;
        origin: string;
      }[];
      return {
        name,
        columns: db.prepare(`PRAGMA table_info(${sqlName(name)})`).all() as LegacyTable["columns"],
        rows: db
          .prepare(`SELECT * FROM ${sqlName(name)} ORDER BY rowid`)
          .all() as LegacyTable["rows"],
        indexes: indexes.map((index) => ({
          ...index,
          sql: (
            db.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(index.name) as {
              sql: string | null;
            }
          ).sql,
          columns: (
            db.prepare(`PRAGMA index_info(${sqlName(index.name)})`).all() as { name: string }[]
          ).map((column) => column.name),
        })),
        foreignKeys: db.prepare(`PRAGMA foreign_key_list(${sqlName(name)})`).all(),
        triggers: (
          db
            .prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=?")
            .all(name) as { sql: string }[]
        ).map((item) => item.sql),
      };
    });
    const metadata = tables.find((table) => table.name === "models");
    const models = (metadata?.rows ?? []).map((row) => ({
      schema: JSON.parse(String(row.schema)) as LegacySchema,
      table: String(row.table_name ?? row.name),
    }));
    const systems = JSON.parse(
      await readFile(
        new URL(
          "../apps/service/src/migration/fixtures/legacy-system-schemas.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as LegacySchema[];
    for (const schema of systems)
      if (
        tables.some((table) => table.name === schema.name) &&
        !models.some((model) => model.schema.name === schema.name)
      )
        models.push({ schema, table: schema.name });
    const roleTable = tables.find((table) => table.name === "_sys_role");
    const superRoles = roleTable?.rows.filter((row) => row.code === "super_admin") ?? [];
    const edges = tables.find((table) => table.name === "_sys_user_roles")?.rows ?? [];
    const superUsers = [
      ...new Set(
        edges
          .filter((row) => row.target_value === superRoles[0]?.id)
          .map((row) => String(row.source_id)),
      ),
    ];
    if (
      models.some((model) => model.schema.name.startsWith("_sys_")) &&
      (superRoles.length !== 1 || superUsers.length !== 1)
    )
      throw new Error("必须盘点出唯一可信超级角色与管理员，不能推测身份映射");
    const categories = Object.fromEntries(
      (tables.find((table) => table.name === "_sys_model_category")?.rows ?? [])
        .filter((row) => ["all", "system", "other"].includes(String(row.code)))
        .map((row) => [String(row.code), String(row.id)]),
    );
    return {
      models,
      tables,
      files: [],
      ...(superRoles.length
        ? {
            identities: {
              bootstrap: superUsers[0]!,
              superRole: String(superRoles[0]!.id),
              categories,
            },
          }
        : {}),
    };
  } finally {
    db.close();
  }
}
/** 读取原文件服务数据；其有效模型作为历史基准，不作为运行时文件来源。 */
export async function inventoryFileState(directory: string): Promise<MigrationInventory["files"]> {
  const files: MigrationInventory["files"] = [];
  for (const name of (await readdir(join(directory, "models"))).filter((name) =>
    name.endsWith(".json"),
  )) {
    const document = JSON.parse(
      await readFile(join(directory, "models", name), "utf8"),
    ) as ModelDocument;
    const records: MigrationInventory["files"][number]["records"] = [];
    let recordNames: string[] = [];
    try {
      recordNames = await readdir(join(directory, "records", document.id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const recordName of recordNames.filter((name) => name.endsWith(".json")))
      records.push(
        JSON.parse(await readFile(join(directory, "records", document.id, recordName), "utf8")),
      );
    files.push({ document, records, published: true });
  }
  return files;
}
/** 读取归档的普通样例，只作为一次性数据库草稿输入。 */
export async function inventorySamples(): Promise<MigrationInventory["files"]> {
  return Promise.all(
    ["orders", "cms"].map(async (name) => ({
      document: JSON.parse(
        await readFile(
          new URL(`../apps/service/src/migration/fixtures/${name}.document.json`, import.meta.url),
          "utf8",
        ),
      ) as ModelDocument,
      records: [],
      published: false,
    })),
  );
}
