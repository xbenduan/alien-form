import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { compileDefinition, migrateLegacyDefinition } from "formwork/model";
import { databaseSchema } from "./database.mjs";
import { createTableSql } from "../src/adapters/d1/compiler/storage";
import { planSchemaUpgrade } from "./schema-upgrade";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(databaseSchema);
  const compiled = compileDefinition({
    schemaVersion: 1,
    id: "legacy",
    title: "旧模型",
    data: { tags: { id: "tags", type: "array", items: { type: "string" } } },
  });
  const { schema: _schema, ...legacy } = compiled;
  delete legacy.document.data.properties.tags.uniqueItems;
  legacy.document.views = { form: { component: "Object" } };
  const manifest = {
    table: compiled.backend.storage.table,
    bindings: compiled.backend.storage.bindings.map((binding) => ({ ...binding, active: true })),
    relations: [],
  };
  db.exec(createTableSql(manifest.table, manifest.bindings));
  db.prepare("INSERT INTO fw_models VALUES(?,?,?,?,?,?,?)").run(
    "legacy",
    "admin",
    1,
    "old-revision",
    manifest.table,
    "before",
    "before",
  );
  db.prepare(
    "INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at) VALUES(?,?,?,?,?,?,?)",
  ).run(
    "legacy",
    1,
    JSON.stringify(legacy),
    JSON.stringify(manifest),
    "publish-old",
    "admin",
    "before",
  );
  db.prepare("INSERT INTO fw_model_drafts VALUES(?,?,?,?,?,?,?)").run(
    "legacy",
    1,
    JSON.stringify(legacy),
    '{"errors":[],"runtimeChecks":[]}',
    null,
    "admin",
    "before",
  );
  db.prepare(`INSERT INTO "${manifest.table}" VALUES(?,?,?,?,?)`).run(
    "record",
    "before",
    "before",
    "admin",
    '{"tags":["a","b"]}',
  );
  const { definition } = migrateLegacyDefinition(legacy, { layoutsMigrated: true });
  const candidates = {
    published: { legacy: definition },
    drafts: { legacy: { ...definition, title: "未发布编辑" } },
    layoutsMigrated: true,
  };
  return { db, legacy, manifest, candidates, query: (sql) => db.prepare(sql).all() };
}
function apply(db, plan) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(plan.statements.join(";\n"));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
it("显式协议升级保留 immutable 版本、物理数据和独立草稿", () => {
  const { db, legacy, candidates, query, manifest } = fixture();
  try {
    const before = query(`SELECT * FROM "${manifest.table}"`);
    const plan = planSchemaUpgrade(query, candidates);
    apply(db, plan);
    expect(
      JSON.parse(
        query("SELECT definition_json FROM fw_model_versions WHERE version=1")[0].definition_json,
      ),
    ).toEqual(legacy);
    expect(query("SELECT active_version,management_revision FROM fw_models")[0]).toMatchObject({
      active_version: 2,
    });
    expect(query("SELECT management_revision FROM fw_models")[0].management_revision).not.toBe(
      "old-revision",
    );
    expect(
      JSON.parse(query("SELECT definition_json FROM fw_model_drafts")[0].definition_json).title,
    ).toBe("未发布编辑");
    expect(
      JSON.parse(query("SELECT draft_json FROM fw_schema_upgrade_backups")[0].draft_json)
        .definition_json,
    ).toBe(JSON.stringify(legacy));
    expect(query(`SELECT * FROM "${manifest.table}"`)).toEqual(before);
    expect(() => apply(db, plan)).toThrow();
    expect(query("SELECT COUNT(*) AS count FROM fw_model_versions")[0].count).toBe(2);
  } finally {
    db.close();
  }
});
it("存量值不兼容、布局未迁入代码和存储改变都阻止生成计划", () => {
  const { db, query, candidates, manifest } = fixture();
  try {
    expect(() => planSchemaUpgrade(query, { ...candidates, layoutsMigrated: false })).toThrow(
      "布局",
    );
    expect(() => planSchemaUpgrade(query, { ...candidates, drafts: {} })).toThrow("候选");
    db.prepare(`UPDATE "${manifest.table}" SET data_content=?`).run('{"tags":["a","a"]}');
    expect(() => planSchemaUpgrade(query, candidates)).toThrow("UNIQUE_ITEMS");
  } finally {
    db.close();
  }
});
it("计划生成后的业务数据变化使整批回滚", () => {
  const { db, query, candidates, manifest } = fixture();
  try {
    const plan = planSchemaUpgrade(query, candidates);
    db.prepare(`UPDATE "${manifest.table}" SET data_content=?`).run('{"tags":["c"]}');
    expect(() => apply(db, plan)).toThrow();
    expect(query("SELECT active_version FROM fw_models")[0].active_version).toBe(1);
    expect(query("SELECT COUNT(*) AS count FROM fw_model_versions")[0].count).toBe(1);
    expect(query("SELECT COUNT(*) AS count FROM fw_commit_guards")[0].count).toBe(0);
  } finally {
    db.close();
  }
});
