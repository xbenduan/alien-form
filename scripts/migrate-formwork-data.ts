import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { planMigration, valueDigest } from "../apps/service/src/migration/convert";
import type { MigrationInventory, MigrationPlan } from "../apps/service/src/migration/types";
import { inventoryDatabase, inventoryFileState, inventorySamples } from "./migration-input";

/** 在明确指定的本地 SQLite 副本内原子导入，并在提交前核对记录值摘要。 */
export async function applyLocalMigration(path: string, plan: MigrationPlan) {
  if (plan.errors.length) throw new Error("迁移计划有错误，不能 apply");
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='fw_models'").get())
      db.exec(
        await readFile(
          new URL("../apps/service/migrations/0100_formwork_metadata.sql", import.meta.url),
          "utf8",
        ),
      );
    const previous = db
      .prepare("SELECT status FROM fw_migration_runs WHERE input_hash=?")
      .get(plan.digest);
    if (previous) {
      db.exec("ROLLBACK");
      return { skipped: true, tables: plan.tables.length };
    }
    for (const statement of plan.statements) db.exec(statement);
    for (const table of plan.tables) {
      const rows = db.prepare(`SELECT * FROM "${table.target}"`).all();
      if (rows.length !== table.count || (await valueDigest(rows)) !== table.digest)
        throw new Error(`数据核对失败 ${table.target}，整个导入已回滚`);
    }
    db.exec("COMMIT");
    return { skipped: false, tables: plan.tables.length };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* Transaction may already have ended. */
    }
    throw error;
  } finally {
    db.close();
  }
}
async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "inventory" },
      input: { type: "string" },
      "source-db": { type: "string" },
      "file-state": { type: "string" },
      samples: { type: "boolean" },
      output: { type: "string" },
      "target-db": { type: "string" },
    },
  });
  if (!["inventory", "plan", "apply-local"].includes(values.mode))
    throw new Error("mode 只允许 inventory、plan、apply-local；没有远端 apply");
  const inventory: MigrationInventory = values.input
    ? JSON.parse(await readFile(values.input, "utf8"))
    : values["source-db"]
      ? await inventoryDatabase(values["source-db"])
      : { models: [], tables: [], files: [] };
  if (values["file-state"])
    inventory.files.push(...(await inventoryFileState(values["file-state"])));
  if (values.samples) inventory.files.push(...(await inventorySamples()));
  const plan = await planMigration(inventory);
  const summary = {
    digest: plan.digest,
    mappings: plan.mappings,
    models: plan.models.map((model) => ({
      id: model.definition.document.id,
      stage: model.stage,
      legacyVersion: model.legacyVersion,
    })),
    tables: plan.tables.map(({ source, target, count, digest }) => ({
      source,
      target,
      count,
      digest,
    })),
    errors: plan.errors,
    warnings: plan.warnings,
  };
  if (values.output)
    await writeFile(
      values.output,
      JSON.stringify(
        values.mode === "inventory" ? inventory : { ...summary, statements: plan.statements },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  console.log(JSON.stringify(summary, null, 2));
  if (plan.errors.length) {
    process.exitCode = 1;
    return;
  }
  if (values.mode === "apply-local") {
    if (!values["target-db"] || values["target-db"].includes("://"))
      throw new Error("apply-local 必须显式提供本地 --target-db；运行前停止该副本的 Worker");
    if (values["source-db"] && resolve(values["source-db"]) === resolve(values["target-db"]))
      throw new Error("源数据库是只读输入，target-db 必须是另一个隔离副本");
    console.log(JSON.stringify(await applyLocalMigration(values["target-db"], plan)));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
