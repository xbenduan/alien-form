import { afterEach, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { planMigration } from "../convert";
import type { LegacySchema } from "../types";
import { inventoryDatabase, inventorySamples } from "../../../../../scripts/migration-input";
import { applyLocalMigration } from "../../../../../scripts/migrate-formwork-data";
import { hashPassword } from "../../application/auth/password";
import { startWorker } from "../../__tests__/worker-harness";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "formwork-migration-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "source.sqlite");
  const db = new DatabaseSync(path);
  const systems = JSON.parse(
    await readFile(new URL("../fixtures/legacy-system-schemas.json", import.meta.url), "utf8"),
  ) as LegacySchema[];
  for (const schema of systems) {
    const columns = schema.fields
      .filter((field) => field.storage && field.relation?.kind !== "many-to-many")
      .map((field) => {
        const name =
          field.key === "createdAt"
            ? "created_at"
            : field.key === "updatedAt"
              ? "updated_at"
              : field.key;
        const type = ["integer", "date", "boolean"].includes(field.storage!.type)
          ? "INTEGER"
          : "TEXT";
        return `"${name}" ${type}${name === "id" ? " PRIMARY KEY" : ""}${field.required && name !== "id" ? " NOT NULL" : ""}`;
      });
    db.exec(
      `CREATE TABLE "${schema.name}" (${columns.join(",")},data_content TEXT NOT NULL DEFAULT '{}')`,
    );
  }
  const passwordHash = await hashPassword("migration-password");
  db.prepare(
    "INSERT INTO _sys_role(id,code,name,parentId,created_at,updated_at,data_content) VALUES (?,?,?,?,?,?,?)",
  ).run("legacy-super", "super_admin", "超级管理员", null, 123, 456, "{}");
  db.prepare(
    "INSERT INTO _sys_role(id,code,name,parentId,created_at,updated_at,data_content) VALUES (?,?,?,?,?,?,?)",
  ).run(
    "legacy-child",
    "editor",
    "编辑",
    "legacy-super",
    123,
    456,
    JSON.stringify({
      canCreateModel: true,
      permissions: [
        { model: "inventory", actions: ["read", "update"], fields: ["name"], scope: "own" },
      ],
    }),
  );
  db.prepare(
    "INSERT INTO _sys_user(id,username,passwordHash,created_at,updated_at,data_content) VALUES (?,?,?,?,?,?)",
  ).run(
    "legacy-admin",
    "integration-admin",
    passwordHash,
    123,
    456,
    JSON.stringify({ __ownerId: "legacy-admin", historicSecret: "保留" }),
  );
  db.exec(
    "CREATE TABLE _sys_user_roles(source_id TEXT NOT NULL,target_value TEXT NOT NULL,PRIMARY KEY(source_id,target_value)); INSERT INTO _sys_user_roles VALUES ('legacy-admin','legacy-super')",
  );
  db.prepare(
    'INSERT INTO _sys_model_category(id,code,name,"order",aggregate,created_at,updated_at,data_content) VALUES (?,?,?,?,?,?,?,?)',
  ).run("legacy-category", "all", "全部", 0, 1, 123, 456, "{}");
  db.exec(
    "CREATE TABLE models(name TEXT PRIMARY KEY, version INTEGER, schema TEXT); CREATE TABLE inventory(id TEXT PRIMARY KEY,name TEXT NOT NULL,retired TEXT,created_at INTEGER,updated_at INTEGER,data_content TEXT NOT NULL)",
  );
  const business: LegacySchema = {
    name: "inventory",
    title: "库存",
    version: 9,
    creatorId: "legacy-admin",
    fields: [
      {
        id: "stable:name",
        key: "name",
        type: "string",
        required: true,
        storage: { type: "text", column: "name" },
        form: {},
      },
    ],
  };
  db.prepare("INSERT INTO models VALUES (?,?,?)").run("inventory", 9, JSON.stringify(business));
  db.prepare("INSERT INTO inventory VALUES (?,?,?,?,?,?)").run(
    "item-1",
    "历史库存",
    "旧值",
    123,
    456,
    JSON.stringify({ __ownerId: "legacy-admin", unknown: { text: "不丢失" } }),
  );
  db.close();
  return { root, path, passwordHash, inventory: await inventoryDatabase(path) };
}
test("只读盘点和本地原子导入保留 IDs、密码、owner、隐藏数据、grant 和重复导入后的新状态", async () => {
  const source = await fixture();
  const plan = await planMigration(source.inventory);
  expect(plan.errors).toEqual([]);
  expect(plan.mappings._sys_user).toBe("system-users");
  expect(
    plan.models.find((model) => model.definition.document.id === "inventory")!.definition.backend
      .permissions.grants,
  ).toEqual([
    { roleId: "legacy-child", actions: ["read", "update"], fields: ["stable:name"], scope: "own" },
  ]);
  const target = join(source.root, "target.sqlite");
  expect((await applyLocalMigration(target, plan)).skipped).toBe(false);
  const db = new DatabaseSync(target);
  expect(db.prepare("SELECT id,passwordHash,data_content FROM _sys_user").get()).toMatchObject({
    id: "legacy-admin",
    passwordHash: source.passwordHash,
  });
  expect(db.prepare("SELECT creator_id,retired FROM inventory").get()).toMatchObject({
    creator_id: "legacy-admin",
    retired: "旧值",
  });
  db.exec("UPDATE inventory SET name='后来修改'");
  db.close();
  expect((await applyLocalMigration(target, plan)).skipped).toBe(true);
  const verify = new DatabaseSync(target, { readOnly: true });
  expect(verify.prepare("SELECT name FROM inventory").get()).toMatchObject({ name: "后来修改" });
  verify.close();
});
test("迁移输入在真实 D1/workerd 中能登录、读取记录与关系，旧版本字段身份仍有效", async () => {
  const source = await fixture();
  const plan = await planMigration(source.inventory);
  expect(plan.errors).toEqual([]);
  const worker = await startWorker({ initialSql: plan.statements, password: "migration-password" });
  cleanups.push(() => worker.close());
  expect(worker.user.id).toBe("legacy-admin");
  expect(worker.user.super).toBe(true);
  expect(await worker.api.records.read("inventory", "item-1")).toMatchObject({
    id: "item-1",
    name: "历史库存",
    creatorId: "legacy-admin",
  });
  expect((await worker.api.records.read("system-users", "legacy-admin")).roleId).toEqual([
    "legacy-super",
  ]);
  expect((await worker.api.models.read("inventory")).publishedVersion).toBe(1);
  expect(
    (await worker.sql("SELECT passwordHash FROM _sys_user"))[0]!.results[0]!.passwordHash,
  ).toBe(source.passwordHash);
});
test("样例仅入草稿，未知字段、悬空关系或身份冲突中止 apply；核对失败回滚整批", async () => {
  const source = await fixture();
  const samples = await planMigration({ models: [], tables: [], files: await inventorySamples() });
  expect(samples.errors).toEqual([]);
  expect(samples.models.every((model) => model.stage === "draft")).toBe(true);
  expect(samples.statements.some((statement) => statement.startsWith('CREATE TABLE "biz_'))).toBe(
    false,
  );
  source.inventory.tables
    .find((table) => table.name === "_sys_user_roles")!
    .rows.push({ source_id: "missing", target_value: "legacy-super" });
  const broken = await planMigration(source.inventory);
  expect(broken.errors[0]!.message).toContain("悬空引用");
  expect(broken.statements).toEqual([]);
  source.inventory.tables.find((table) => table.name === "_sys_user_roles")!.rows.pop();
  const plan = await planMigration(source.inventory);
  plan.tables[0]!.digest = "wrong";
  const target = join(source.root, "rollback.sqlite");
  await expect(applyLocalMigration(target, plan)).rejects.toThrow("数据核对失败");
  const db = new DatabaseSync(target);
  expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all()).toEqual([]);
  db.close();
});
