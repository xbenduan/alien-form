import { afterEach, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import type {
  CapabilityLayer,
  CapabilityManifest,
  ModelDefinition,
  ModelDocument,
} from "formwork/model";
import { capabilityReport } from "../../application/capabilities";
import { migratePageLocalViews } from "../page-local-views";

const databases: DatabaseSync[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
const view = { component: "Input", field: "/title" };
const localView = { ...view, props: { placeholder: "局部配置" } };
const document: ModelDocument = {
  id: "cms",
  data: { type: "object", properties: { title: { type: "string" } } },
};
const layer: CapabilityLayer = {
  components: [
    { name: "Input", declaration: "Input", source: { file: "ui.tsx", line: 1, column: 1 } },
  ],
  fn: [],
  runtimeChecks: [],
  getSchema: { name: "load", declaration: "load", source: { file: "page.ts", line: 1, column: 1 } },
};
const manifest: CapabilityManifest = {
  formatVersion: 2,
  appId: "alien-form",
  revision: "a".repeat(64),
  clientOrigin: "http://localhost:5173",
  presenters: ["page"],
  framework: layer,
  domains: {},
  pages: Object.fromEntries(
    ["list", "tree-list"].map((router) => [
      router,
      {
        path: `/${router}/:modelId`,
        model: true,
        capabilities: layer,
        windows: Object.fromEntries(
          ["add", "edit", "detail"].map((name) => [
            name,
            {
              path: `/${router}/:modelId/${name}${name === "add" ? "" : "/:id"}`,
              model: true,
              openMode: "page" as const,
              capabilities: layer,
            },
          ]),
        ),
      },
    ]),
  ),
};
async function migration() {
  return readFile(
    new URL("../../../migrations/0102_page_local_views.sql", import.meta.url),
    "utf8",
  );
}
async function fixture() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of ["0100_formwork_metadata.sql", "0101_model_menu_pins.sql"])
    db.exec(await readFile(new URL(`../../../migrations/${file}`, import.meta.url), "utf8"));
  db.exec(`
    INSERT INTO fw_models VALUES ('cms','creator',2,'management-revision','biz_cms','created','updated');
    INSERT INTO fw_models VALUES ('orders','creator',1,'orders-revision','biz_orders','created','updated');
    CREATE TABLE biz_cms(id TEXT PRIMARY KEY,title TEXT,model_version INTEGER,revision TEXT);
    INSERT INTO biz_cms VALUES ('record-1','历史内容',1,'record-revision');
  `);
  const definition = (views?: ModelDocument["views"]) =>
    JSON.stringify({
      document: { ...document, ...(views ? { views } : {}) },
      backend: { sentinel: "后端配置原样保留" },
    });
  const originals = [
    definition({ add: view, edit: view, detail: view, "list/edit": localView }),
    definition({ edit: view }),
    definition({ add: view, "tree-list/add": localView }),
  ];
  for (const [index, value] of originals.slice(0, 2).entries())
    db.prepare("INSERT INTO fw_model_versions VALUES (?,?,?,?,?,?,?,?)").run(
      "cms",
      index + 1,
      value,
      '{"bindings":[]}',
      `publish-${index}`,
      "old-manifest",
      "publisher",
      "published",
    );
  db.prepare("INSERT INTO fw_model_versions VALUES (?,?,?,?,?,?,?,?)").run(
    "orders",
    1,
    definition(),
    '{"bindings":[]}',
    "orders-publish",
    "old-manifest",
    "publisher",
    "published",
  );
  db.prepare("INSERT INTO fw_model_drafts VALUES (?,?,?,?,?,?,?)").run(
    "cms",
    2,
    originals[2]!,
    '[{"code":"OLD_DIAGNOSTIC"}]',
    "old-manifest",
    "editor",
    "draft-updated",
  );
  return { db, originals };
}
function definitions(db: DatabaseSync) {
  return db
    .prepare("SELECT definition_json FROM fw_model_versions WHERE model_id='cms' ORDER BY version")
    .all()
    .concat(db.prepare("SELECT definition_json FROM fw_model_drafts WHERE model_id='cms'").all())
    .map((row) => row.definition_json as string);
}
function metadata(db: DatabaseSync) {
  return {
    models: db.prepare("SELECT * FROM fw_models ORDER BY id").all(),
    versions: db
      .prepare(
        "SELECT model_id,version,storage_manifest_json,publish_revision,manifest_revision,published_by,published_at FROM fw_model_versions ORDER BY model_id,version",
      )
      .all(),
    drafts: db
      .prepare(
        "SELECT model_id,base_version,diagnostics_json,validated_manifest_revision,updated_by,updated_at FROM fw_model_drafts",
      )
      .all(),
    records: db.prepare("SELECT * FROM biz_cms").all(),
  };
}
test("已有 D1 的全局 View 迁移后通过清单校验，备份原定义并保持历史版本、局部覆盖和记录", async () => {
  const { db, originals } = await fixture();
  const before = metadata(db);
  const active = JSON.parse(originals[1]!) as ModelDefinition;
  expect(capabilityReport(manifest, active.document).errors).toContainEqual(
    expect.objectContaining({
      path: "/document/views/edit",
      code: "UNKNOWN_ROUTER",
      modelId: "cms",
    }),
  );
  db.exec(`BEGIN; ${await migration()} COMMIT;`);
  for (const [index, value] of definitions(db).entries()) {
    const migrated = JSON.parse(value) as ModelDefinition;
    const original = JSON.parse(originals[index]!) as ModelDefinition;
    expect(migrated).toEqual({ ...original, document: migratePageLocalViews(original.document) });
    expect(capabilityReport(manifest, migrated.document).errors).toEqual([]);
  }
  expect(metadata(db)).toEqual(before);
  expect(
    db
      .prepare(
        "SELECT definition_json FROM fw_page_local_views_backup WHERE model_id='cms' ORDER BY CASE source WHEN 'version' THEN 0 ELSE 1 END, version",
      )
      .all()
      .map((row) => row.definition_json),
  ).toEqual(originals);
  expect(
    db
      .prepare("SELECT COUNT(*) AS count FROM fw_page_local_views_backup WHERE model_id='orders'")
      .get(),
  ).toMatchObject({ count: 0 });
  expect(() =>
    db.exec("UPDATE fw_model_versions SET definition_json='{}' WHERE model_id='cms'"),
  ).toThrow("published versions are immutable");
  expect(() => db.exec("DELETE FROM fw_model_versions WHERE model_id='cms'")).toThrow(
    "published versions are immutable",
  );
});
test("无全局 View 或无效全局值保持原样，显式 null 覆盖仍保留为配置错误", async () => {
  const { db } = await fixture();
  const untouched = JSON.stringify({
    document: {
      ...document,
      views: { add: "invalid", edit: null, detail: [], 'custom/"view': view },
    },
  });
  db.prepare("INSERT INTO fw_model_drafts VALUES (?,?,?,?,?,?,?)").run(
    "orders",
    1,
    untouched,
    "[]",
    null,
    "editor",
    "updated",
  );
  const draft = JSON.stringify({
    document: { ...document, views: { edit: view, "list/edit": null } },
  });
  db.prepare("UPDATE fw_model_drafts SET definition_json=? WHERE model_id='cms'").run(draft);
  db.exec(`BEGIN; ${await migration()} COMMIT;`);
  expect(
    db.prepare("SELECT definition_json FROM fw_model_drafts WHERE model_id='orders'").get(),
  ).toMatchObject({ definition_json: untouched });
  expect(JSON.parse(definitions(db)[2]!).document.views).toEqual({
    "list/edit": null,
    "tree-list/edit": view,
  });
});
test("迁移事务失败会恢复原定义和不可修改保护，不留下部分备份", async () => {
  const { db, originals } = await fixture();
  const before = metadata(db);
  const sql = await migration();
  db.exec("BEGIN");
  expect(() => db.exec(`${sql} INSERT INTO fw_commit_guards VALUES ('fault',0);`)).toThrow();
  db.exec("ROLLBACK");
  expect(definitions(db)).toEqual(originals);
  expect(metadata(db)).toEqual(before);
  expect(
    db.prepare("SELECT 1 FROM sqlite_schema WHERE name='fw_page_local_views_backup'").get(),
  ).toBeUndefined();
  expect(() => db.exec("UPDATE fw_model_versions SET definition_json='{}'")).toThrow(
    "published versions are immutable",
  );
});
