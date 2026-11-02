import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { developmentDirectory, initializeDatabase } from "./database.mjs";
import { systemModels } from "../src/sys-models";
import { createTableSql, literal, quote } from "../src/adapters/d1/compiler/storage";
import type { ModelDefinition } from "formwork/model";
import type { StorageManifest } from "../src/contracts";

const wrangler = resolve(import.meta.dirname, "../node_modules/wrangler/bin/wrangler.js");
async function execute(args: string[]): Promise<string> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      errors += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? done(output)
        : reject(new Error(`D1 初始化失败 (${code}): ${errors}\n${output}`)),
    );
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      local: { type: "boolean" },
      remote: { type: "boolean" },
      config: { type: "string", default: resolve(import.meta.dirname, "../wrangler.json") },
      env: { type: "string" },
    },
  });
  if (!!values.local === !!values.remote) throw new Error("必须指定 --local 或 --remote");
  const directory = values.local
    ? developmentDirectory()
    : await mkdtemp(join(tmpdir(), "alien-form-deploy-"));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const state = join(directory, "state");
  const common = [
    values.local ? "--local" : "--remote",
    "--config",
    values.config,
    ...(values.env ? ["--env", values.env] : []),
    ...(values.local ? ["--persist-to", state] : []),
  ];
  async function query<T>(sql: string): Promise<T[]> {
    const response = JSON.parse(
      await execute(["d1", "execute", "DB", ...common, "--command", sql, "--json"]),
    ) as Array<{ results: T[] }>;
    return response.flatMap((result) => result.results);
  }
  try {
    await initializeDatabase({ directory, state, common, local: !!values.local, execute });
    if (values.remote)
      await synchronizeSystemModels(query, async (statements) => {
        const file = join(directory, "system-models.sql");
        await writeFile(file, `${statements.join(";\n")};\n`, { mode: 0o600 });
        await execute(["d1", "execute", "DB", ...common, "--file", file, "--yes"]);
      });
    console.log(values.local ? `本地 D1 已清空重建: ${state}` : "远端 D1 表结构已初始化");
  } finally {
    if (values.remote) await rm(directory, { recursive: true, force: true });
  }
}

/**
 * 将代码中的系统模型同步为新发布版本，并补齐新增物理列。
 * @param query 在目标 D1 上读取 SQL 查询结果。
 * @param apply 执行完整 SQL 计划；定义未变化时不会调用。
 */
export async function synchronizeSystemModels(
  query: <T>(sql: string) => Promise<T[]>,
  apply: (statements: string[]) => Promise<void>,
): Promise<void> {
  const [identity] = await query<{ record_id: string }>(
    "SELECT record_id FROM fw_system_identities WHERE name='bootstrap'",
  );
  // 新库在 Worker 第一次请求时用 bootstrap secrets 初始化账号和系统模型。
  if (!identity) return;
  const statements: string[] = [];
  const now = new Date().toISOString();
  for (const definition of systemModels) {
    const id = definition.document.id;
    const [current] = await query<{
      active_version: number;
      definition_json: string;
      storage_manifest_json: string;
      draft_id: string | null;
    }>(
      `SELECT m.active_version,v.definition_json,v.storage_manifest_json,d.model_id AS draft_id
       FROM fw_models m JOIN fw_model_versions v ON v.model_id=m.id AND v.version=m.active_version
       LEFT JOIN fw_model_drafts d ON d.model_id=m.id
       WHERE m.id=${literal(id)}`,
    );
    const previous = current
      ? (JSON.parse(current.storage_manifest_json) as StorageManifest)
      : undefined;
    const previousDefinition = current
      ? (JSON.parse(current.definition_json) as ModelDefinition)
      : undefined;
    if (JSON.stringify(previousDefinition) === JSON.stringify(definition)) {
      if (current?.draft_id)
        statements.push(`DELETE FROM fw_model_drafts WHERE model_id=${literal(id)}`);
      continue;
    }
    const { table, bindings } = definition.backend.storage;
    if (previous && previous.table !== table)
      throw new Error(`${id} 修改主表需要在 script/migrate.ts 中显式处理`);
    const manifest: StorageManifest = {
      table,
      bindings: previous?.bindings.map((binding) => ({ ...binding, active: false })) ?? [],
      relations: definition.backend.relations.map((relation) => ({
        ...relation,
        active: true,
        table: relation.through,
      })),
    };
    for (const binding of bindings) {
      const before = manifest.bindings.find((item) => item.id === binding.id);
      if (
        before &&
        (before.column !== binding.column ||
          before.jsonKey !== binding.jsonKey ||
          before.sqlType !== binding.sqlType ||
          before.encoding !== binding.encoding)
      )
        throw new Error(`${id} 字段 ${binding.id} 修改存储需要在 script/migrate.ts 中显式处理`);
      if (before) Object.assign(before, binding, { active: true });
      else manifest.bindings.push({ ...binding, active: true });
    }
    if (
      previous &&
      JSON.stringify(previousDefinition?.backend.relations) !==
        JSON.stringify(definition.backend.relations)
    )
      throw new Error(`${id} 修改关系需要在 script/migrate.ts 中显式处理`);
    const columns = await query<{ name: string; type: string }>(
      `PRAGMA table_info(${quote(table)})`,
    );
    if (!columns.length) statements.push(createTableSql(table, manifest.bindings));
    else
      for (const binding of bindings) {
        if (!binding.column) continue;
        const column = columns.find((item) => item.name === binding.column);
        if (!column)
          statements.push(
            `ALTER TABLE ${quote(table)} ADD COLUMN ${quote(binding.column)} ${binding.sqlType}`,
          );
        else if (column.type.toUpperCase() !== binding.sqlType)
          throw new Error(`${id} 列 ${binding.column} 类型不一致，需要显式处理`);
      }
    for (const binding of bindings)
      if (binding.index && binding.column)
        statements.push(
          `CREATE ${binding.index === "unique" ? "UNIQUE " : ""}INDEX IF NOT EXISTS
           ${quote(`fwidx_${table}_${binding.column}`)} ON ${quote(table)}(${quote(binding.column)})`,
        );
    for (const relation of manifest.relations)
      if (relation.table)
        statements.push(
          `CREATE TABLE IF NOT EXISTS ${quote(relation.table)}(
          source_id TEXT NOT NULL,target_value TEXT NOT NULL,PRIMARY KEY(source_id,target_value))`,
          `INSERT INTO fw_relation_tables(source_model_id,field_id,table_name)
         VALUES (${literal(id)},${literal(relation.fieldId)},${literal(relation.table)})
         ON CONFLICT(source_model_id,field_id) DO NOTHING`,
        );
    const version = (current?.active_version ?? 0) + 1;
    const revision = crypto.randomUUID();
    statements.push(
      `INSERT INTO fw_models(id,creator_id,active_version,management_revision,storage_table,created_at,updated_at)
       VALUES (${literal(id)},${literal(identity.record_id)},${version},${literal(revision)},${literal(table)},${literal(now)},${literal(now)})
       ON CONFLICT(id) DO UPDATE SET active_version=excluded.active_version,
         management_revision=excluded.management_revision,storage_table=excluded.storage_table,updated_at=excluded.updated_at`,
      `INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at)
       VALUES (${literal(id)},${version},${literal(JSON.stringify(definition))},${literal(JSON.stringify(manifest))},
         ${literal(crypto.randomUUID())},${literal(identity.record_id)},${literal(now)})`,
      `DELETE FROM fw_model_drafts WHERE model_id=${literal(id)}`,
    );
  }
  if (statements.length) await apply(statements);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
