import type { Container } from "../../../container.ts";
import { ensureRecord } from "../../global/initialization.ts";

/** Finishes the dynamic-table part of the model category rename once per database. */
export async function prepare(container: Container): Promise<void> {
  const db = container.db;
  const migration = "migration:model-category";
  if (await db.prepare(`SELECT 1 FROM "_sequences" WHERE "name" = ?`).bind(migration).first()) {
    return;
  }

  const [legacyTable, categoryTable, roleTable] = await Promise.all([
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_model_tab'`)
      .first(),
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_model_category'`)
      .first(),
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_role'`).first(),
  ]);
  if (legacyTable && categoryTable) {
    throw new Error("模型分类迁移失败：新旧物理表同时存在");
  }

  const statements: D1PreparedStatement[] = [];
  if (legacyTable) {
    statements.push(db.prepare(`ALTER TABLE "_sys_model_tab" RENAME TO "_sys_model_category"`));
  }
  if (legacyTable || categoryTable) {
    statements.push(
      db.prepare(
        `UPDATE "_sys_model_category"
         SET "id" = CASE "id"
           WHEN 'SYSTAB000001' THEN 'SYSCATEGORY000001'
           WHEN 'SYSTAB000002' THEN 'SYSCATEGORY000002'
           WHEN 'SYSTAB000003' THEN 'SYSCATEGORY000003'
           ELSE "id"
         END`,
      ),
      db.prepare(`DROP INDEX IF EXISTS "uidx__sys_model_tab_code"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_code"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_name"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_order"`),
      db.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS "uidx__sys_model_category_code"
         ON "_sys_model_category" ("code")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_code"
         ON "_sys_model_category" ("code")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_name"
         ON "_sys_model_category" ("name")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_order"
         ON "_sys_model_category" ("order")`,
      ),
    );
  }
  if (roleTable) {
    statements.push(
      db.prepare(
        `UPDATE "_sys_role"
         SET "data_content" = replace(
           "data_content",
           '"model":"_sys_model_tab"',
           '"model":"_sys_model_category"'
         )
         WHERE "data_content" LIKE '%"model":"_sys_model_tab"%'`,
      ),
    );
  }
  statements.push(
    db.prepare(`INSERT INTO "_sequences" ("name", "next") VALUES (?, 1)`).bind(migration),
  );
  await db.batch(statements);
}

/** Seeds categories used by the model home page and editor. */
export async function initialize(
  container: Container,
  constants: {
    readonly code: string;
    readonly allId: string;
    readonly systemId: string;
    readonly otherId: string;
  },
  actorId: string,
): Promise<void> {
  await ensureRecord(
    container,
    constants.code,
    constants.allId,
    {
      code: "all",
      name: "全部",
      order: 0,
      aggregate: true,
      description: "聚合展示全部可访问模型。",
    },
    actorId,
  );
  await ensureRecord(
    container,
    constants.code,
    constants.systemId,
    {
      code: "system",
      name: "系统",
      order: 10,
      aggregate: false,
      description: "系统内置模型。",
    },
    actorId,
  );
  await ensureRecord(
    container,
    constants.code,
    constants.otherId,
    {
      code: "other",
      name: "其他",
      order: 20,
      aggregate: false,
      description: "默认业务模型分类。",
    },
    actorId,
  );
}
