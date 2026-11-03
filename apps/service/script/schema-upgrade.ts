import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { isDeepStrictEqual } from "node:util";
import {
  compileDefinition,
  isObject,
  modelIssues,
  resolveModel,
  schemaType,
  validateValue,
} from "formwork/model";
import type { CompiledDefinition, ModelDefinition, RecordValue } from "formwork/model";
import { modelContract } from "../../../packages/domain-contracts";
import type { StorageManifest, StoredModel } from "../src/contracts";
import { bindingKey, literal, quote } from "../src/adapters/d1/compiler/storage";
import { decodeRow } from "../src/adapters/d1/repositories/values";
import type { PhysicalRow } from "../src/adapters/d1/repositories/values";

type Row = Record<string, string | number | null>;
type Query = <T = Row>(sql: string) => T[];
type Version = Row & {
  model_id: string;
  version: number;
  definition_json: string;
  storage_manifest_json: string;
};
/** 提供逐个审阅的发布定义及草稿，草稿不会自动替换发布定义。 */
export type SchemaUpgradeCandidates = {
  published: Record<string, ModelDefinition>;
  drafts: Record<string, ModelDefinition>;
  layoutsMigrated?: boolean;
};
/** 保存可审阅的 SQL；所有 statements 必须作为一个事务提交。 */
export type SchemaUpgradePlan = { models: string[]; statements: string[] };

/** 从一致的只读备份生成协议升级计划，保留发布历史、原草稿及全部物理数据。
 * @param query 读取同一 SQLite 备份，不连接在线数据库。
 * @param candidates 显式审阅后的新协议定义；不允许借协议升级改变存储或权限。
 */
export function planSchemaUpgrade(
  query: Query,
  candidates: SchemaUpgradeCandidates,
): SchemaUpgradePlan {
  const heads = query<Row & { id: string; active_version: number | null }>(
    "SELECT * FROM fw_models",
  );
  const drafts = query<Row & { model_id: string; definition_json: string }>(
    "SELECT * FROM fw_model_drafts",
  );
  const versions = query<Version>("SELECT * FROM fw_model_versions");
  const models = new Map<
    string,
    { definition: CompiledDefinition; manifest: StorageManifest; version: Version }
  >();
  const upgraded = new Set<string>();
  const fail = (message: string): never => {
    throw new Error(`MIGRATION_REQUIRED: ${message}`);
  };
  const parse = (candidate: ModelDefinition | undefined, id: string) => {
    if (!candidate || candidate.id !== id) return fail(`${id} 缺少匹配的已审阅候选定义`);
    const issues = modelIssues(candidate, modelContract(candidate));
    if (issues.length) return fail(`${id}: ${JSON.stringify(issues)}`);
    return candidate;
  };
  const confirmLayout = (legacy: unknown, id: string) => {
    const document = isObject(legacy) && isObject(legacy.document) ? legacy.document : {};
    if (
      !candidates.layoutsMigrated &&
      ["views", "pages"].some((key) => isObject(document[key]) && Object.keys(document[key]).length)
    )
      fail(`${id} 的旧布局需要先迁入 Page/Window，再设置 layoutsMigrated`);
  };
  for (const head of heads) {
    if (head.active_version === null) continue;
    const version = versions.find(
      (row) => row.model_id === head.id && row.version === head.active_version,
    );
    if (!version) fail(`${head.id} 当前发布版本不存在`);
    const before = JSON.parse(version!.definition_json) as CompiledDefinition;
    const manifest = JSON.parse(version!.storage_manifest_json) as StorageManifest;
    let definition = before;
    if (!before.schema) {
      confirmLayout(before, head.id);
      const schema = parse(candidates.published[head.id], head.id);
      definition = compileDefinition(schema, modelContract(schema));
      const bindings = (value: CompiledDefinition) =>
        [...value.backend.storage.bindings].sort((a, b) => a.id.localeCompare(b.id));
      if (
        definition.backend.storage.table !== manifest.table ||
        !isDeepStrictEqual(bindings(definition), bindings(before))
      )
        fail(`${head.id} 的字段 id、地址、存储或索引发生变化，请分开迁移`);
      if (
        !isDeepStrictEqual(definition.backend.permissions, before.backend.permissions) ||
        !isDeepStrictEqual(definition.backend.behavior, before.backend.behavior)
      )
        fail(`${head.id} 的权限或可信行为发生变化，请分开迁移`);
      upgraded.add(head.id);
    }
    models.set(head.id, { definition, manifest, version: version! });
  }
  for (const id of Object.keys(candidates.published))
    if (!upgraded.has(id)) fail(`${id} 不是待升级的已发布模型`);
  const tables = new Set([
    "fw_models",
    "fw_model_drafts",
    "fw_model_versions",
    "fw_relation_tables",
  ]);
  const records = new Map<string, RecordValue[]>();
  for (const [id, model] of models) {
    tables.add(model.manifest.table);
    for (const relation of model.manifest.relations) if (relation.table) tables.add(relation.table);
    for (const relation of model.definition.backend.relations) {
      const target = models.get(relation.targetModel)?.definition;
      const binding = target?.backend.storage.bindings.find(
        (item) => item.path === relation.valueField,
      );
      // 新协议目标路径被编译成稳定 id；旧协议已有稳定 id，仅新快照需要补齐路径。
      if (!upgraded.has(id)) continue;
      const label = target?.backend.storage.bindings.find(
        (item) => item.path === relation.labelField,
      );
      if (
        !binding ||
        (binding.path !== "/id" && binding.index !== "unique") ||
        !label ||
        label.encoding !== "scalar" ||
        target!.backend.permissions.privateFields.some(
          (field) => field === binding.id || field === label.id,
        )
      )
        fail(`${id} 的关系目标或展示字段无效`);
      relation.targetFieldId = binding!.id;
      const source = model.definition.backend.storage.bindings.find(
        (item) => item.id === relation.fieldId,
      )!;
      const sourceSchema = model.definition.document.data.properties[bindingKey(source)]!;
      const targetSchema = target!.document.data.properties[bindingKey(binding!)]!;
      if (
        schemaType("items" in sourceSchema ? sourceSchema.items : sourceSchema) !==
        schemaType(targetSchema)
      )
        fail(`${id} 关系源与目标类型不同`);
    }
    if (upgraded.has(id)) {
      const before = JSON.parse(model.version.definition_json) as CompiledDefinition;
      const signature = (definition: CompiledDefinition) =>
        definition.backend.relations
          .map(({ valueField: _value, labelField: _label, ...relation }) => relation)
          .sort((a, b) => a.fieldId.localeCompare(b.fieldId));
      if (!isDeepStrictEqual(signature(before), signature(model.definition)))
        fail(`${id} 关系存储、基数或目标身份发生变化`);
    }
    const rows = query<PhysicalRow>(`SELECT * FROM ${quote(model.manifest.table)}`);
    const stored = { definition: model.definition, manifest: model.manifest } as StoredModel;
    const resolved = resolveModel(model.definition.schema, modelContract(model.definition.schema));
    const values = rows.map((row) => {
      const record = decodeRow(stored, row);
      for (const relation of model.manifest.relations) {
        if (!relation.active || !relation.table) continue;
        const binding = model.definition.backend.storage.bindings.find(
          (item) => item.id === relation.fieldId,
        )!;
        const field = bindingKey(binding);
        const joined = query<{ target_value: string }>(
          `SELECT target_value FROM ${quote(relation.table)} WHERE source_id=${literal(row.id)} ORDER BY target_value`,
        ).map((item) => item.target_value);
        if (!Object.hasOwn(record, field) && joined.length) record[field] = joined;
      }
      const issues = [
        ...validateValue(model.definition.document.data, record),
        ...resolved.validateFormats(record),
      ];
      if (issues.length) fail(`${id} 记录 ${row.id} 不满足新契约: ${JSON.stringify(issues)}`);
      return record;
    });
    records.set(id, values);
  }
  for (const [id, model] of models)
    for (const relation of model.definition.backend.relations) {
      if (!upgraded.has(id)) continue;
      const source = model.definition.backend.storage.bindings.find(
        (item) => item.id === relation.fieldId,
      )!;
      const target = models
        .get(relation.targetModel)!
        .definition.backend.storage.bindings.find((item) => item.id === relation.targetFieldId)!;
      const available = new Set(
        records.get(relation.targetModel)!.map((row) => JSON.stringify(row[bindingKey(target)])),
      );
      for (const record of records.get(id)!) {
        const value = record[bindingKey(source)];
        const values = Array.isArray(value) ? value : value == null ? [] : [value];
        if (values.some((item) => !available.has(JSON.stringify(item))))
          fail(`${id} 记录 ${String(record.id)} 存在失效引用`);
      }
    }
  const replacements = drafts.flatMap((draft) => {
    const before = JSON.parse(draft.definition_json);
    if (before.schemaVersion === 1) return [];
    confirmLayout(before, draft.model_id);
    return [{ draft, definition: parse(candidates.drafts[draft.model_id], draft.model_id) }];
  });
  for (const id of Object.keys(candidates.drafts))
    if (!replacements.some((item) => item.draft.model_id === id)) fail(`${id} 不是待升级的草稿`);
  if (!upgraded.size && !replacements.length) fail("备份中没有待升级定义");
  const statements: string[] = [];
  const guardId = crypto.randomUUID();
  const guard = (condition: string) => {
    const id = `${guardId}:${statements.length}`;
    statements.push(
      `INSERT INTO fw_commit_guards(id,ok) VALUES(${literal(id)},CASE WHEN (${condition}) THEN 1 ELSE 0 END)`,
    );
    statements.push(`DELETE FROM fw_commit_guards WHERE id=${literal(id)}`);
  };
  // 所有读到的 metadata、业务记录与 through 行进入 CAS，防止离线校验后数据变化。
  for (const table of tables) {
    const rows = query<Row>(`SELECT * FROM ${quote(table)}`);
    guard(`(SELECT COUNT(*) FROM ${quote(table)})=${rows.length}`);
    for (const row of rows) {
      const equals = Object.entries(row).map(([key, value]) => {
        if (value !== null && typeof value !== "number" && typeof value !== "string")
          fail(`${table} 包含不支持的物理值`);
        if (typeof value === "string" && value.includes("\0"))
          fail(`${table} 包含 NUL 字符，需要专用迁移`);
        return `${quote(key)} IS ${value === null ? "NULL" : typeof value === "number" ? value : literal(value)}`;
      });
      guard(`EXISTS(SELECT 1 FROM ${quote(table)} WHERE ${equals.join(" AND ")})`);
    }
  }
  statements.push(
    "CREATE TABLE IF NOT EXISTS fw_schema_upgrade_backups(id TEXT PRIMARY KEY,model_id TEXT NOT NULL,draft_json TEXT NOT NULL,created_at TEXT NOT NULL)",
  );
  const now = new Date().toISOString();
  for (const id of upgraded) {
    const model = models.get(id)!;
    const version =
      Math.max(...versions.filter((row) => row.model_id === id).map((row) => row.version)) + 1;
    const manifest: StorageManifest = {
      ...model.manifest,
      relations: model.manifest.relations.map((relation) => ({
        ...relation,
        ...(relation.active
          ? model.definition.backend.relations.find((item) => item.fieldId === relation.fieldId)
          : {}),
      })),
    };
    statements.push(
      `INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at)
       VALUES(${literal(id)},${version},${literal(JSON.stringify(model.definition))},${literal(JSON.stringify(manifest))},${literal(crypto.randomUUID())},${literal(String(model.version.published_by))},${literal(now)})`,
      `UPDATE fw_models SET active_version=${version},management_revision=${literal(crypto.randomUUID())},updated_at=${literal(now)} WHERE id=${literal(id)}`,
    );
  }
  for (const { draft, definition } of replacements) {
    statements.push(
      `INSERT INTO fw_schema_upgrade_backups VALUES(${literal(crypto.randomUUID())},${literal(draft.model_id)},${literal(JSON.stringify(draft))},${literal(now)})`,
      `UPDATE fw_model_drafts SET definition_json=${literal(JSON.stringify(definition))},diagnostics_json='{"errors":[],"runtimeChecks":[{"path":"/data","code":"REVALIDATE","message":"请在新版本中重新校验草稿"}]}',validated_manifest_revision=NULL,updated_at=${literal(now)} WHERE model_id=${literal(draft.model_id)}`,
      `UPDATE fw_models SET management_revision=${literal(crypto.randomUUID())},updated_at=${literal(now)} WHERE id=${literal(draft.model_id)}`,
    );
  }
  return {
    models: [...new Set([...upgraded, ...replacements.map((item) => item.draft.model_id)])],
    statements,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      database: { type: "string" },
      candidates: { type: "string" },
      output: { type: "string" },
    },
  });
  if (!values.database || !values.candidates || !values.output)
    throw new Error(
      "用法: node --import tsx apps/service/script/schema-upgrade.ts --database backup.sqlite --candidates reviewed.json --output upgrade.json",
    );
  const db = new DatabaseSync(resolve(values.database), { readOnly: true });
  try {
    db.exec("BEGIN");
    const candidates = JSON.parse(
      await readFile(resolve(values.candidates), "utf8"),
    ) as SchemaUpgradeCandidates;
    const plan = planSchemaUpgrade(<T>(sql: string) => db.prepare(sql).all() as T[], candidates);
    await writeFile(resolve(values.output), `${JSON.stringify(plan, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(`已生成 ${plan.models.length} 个模型的事务计划；数据库未修改。`);
  } finally {
    db.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
