import { beforeAll, afterAll, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createFormworkApi } from "formwork/model";
import type {
  ModelDefinition,
  DraftDefinition,
  CapabilityManifest,
  DataSchema,
} from "formwork/model";
import { startWorker } from "./worker-harness";

let worker: Awaited<ReturnType<typeof startWorker>>;
const baseComponents = [
  "Object",
  "Array",
  "Input",
  "NumberInput",
  "Select",
  "Switch",
  "Null",
  "RichText",
];
function manifest(): CapabilityManifest {
  const source = { file: "src/formwork.tsx", line: 1, column: 1 };
  const components = baseComponents.map((name) => ({
    name,
    source,
    declaration: `(props) => JSX.Element`,
  }));
  const routes = [
    { router: "list", path: "/list/:domain" },
    { router: "add", path: "/add/:domain", presentation: "modal" as const, returnTo: "list" },
    { router: "edit", path: "/edit/:domain/:id", presentation: "modal" as const, returnTo: "list" },
    {
      router: "detail",
      path: "/detail/:domain/:id",
      presentation: "drawer" as const,
      returnTo: "list",
    },
  ];
  const contents = {
    appId: "alien-form",
    clientOrigin: "http://localhost:5173",
    routes,
    schemaRouters: routes.map((route) => route.router),
    defaultCapabilities: Object.fromEntries(
      routes.map(({ router }) => [
        router,
        {
          modelId: "",
          router,
          components,
          fn: [],
          modelContract: "ModelDefinition",
          runtimeChecks: [],
        },
      ]),
    ),
    domainCapabilities: {},
  };
  return {
    ...contents,
    revision: createHash("sha256").update(JSON.stringify(contents)).digest("hex"),
  };
}
function definition(
  id: string,
  properties: Record<string, DataSchema> = {
    title: { type: "string" },
    count: { type: "integer" },
    paid: { type: "boolean" },
  },
): ModelDefinition {
  return {
    document: { id, title: id, data: { type: "object", properties, required: ["title"] } },
    backend: {
      storage: {
        table: `test_${id}`,
        bindings: Object.entries(properties).map(([key, schema]) => ({
          id: `${id}:${key}`,
          path: `/${key}`,
          column: key,
          sqlType:
            ("type" in schema && schema.type === "integer") ||
            ("type" in schema && schema.type === "boolean")
              ? "INTEGER"
              : "TEXT",
          encoding:
            "type" in schema && ["array", "object"].includes(String(schema.type))
              ? "json"
              : "scalar",
        })),
      },
      relations: [],
      permissions: { grants: [], privateFields: [] },
      behavior: { rules: [], commands: {}, events: {} },
    },
  };
}
const draft = (definition: ModelDefinition) => definition as unknown as DraftDefinition;
async function publish(definition: ModelDefinition) {
  const current = await worker.api.models.saveDraft(definition.document.id, definition, {
    ifRevision: null,
  });
  return worker.api.models.publish(definition.document.id, current.revision);
}
beforeAll(async () => {
  worker = await startWorker();
  const value = manifest();
  const response = await worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    { revision: value.revision, manifest: value, origin: value.clientOrigin },
    worker.capabilityToken,
  );
  expect(await response.json()).toMatchObject({ registered: true });
}, 60_000);
afterAll(async () => {
  await worker?.close();
});

it("真实 D1 登录、可信 token 类型、撤销与 CORS", async () => {
  expect(await worker.api.auth.me()).toMatchObject({ kind: "user", super: true });
  expect((await worker.request("/models", "GET", undefined, "")).status).toBe(401);
  expect((await worker.request("/models", "GET", undefined, worker.capabilityToken)).status).toBe(
    403,
  );
  expect(
    (
      await worker.request("/models", "GET", undefined, worker.token, {
        Origin: "https://evil.example",
      })
    ).status,
  ).toBe(403);
  const agent = await worker.api.auth.issueToken({ label: "Agent", expiresInDays: 1 });
  expect((await worker.request("/auth/me", "GET", undefined, agent.token)).status).toBe(200);
  expect(
    (
      await worker.request(
        "/models/system-users/publish",
        "POST",
        { ifRevision: "any" },
        agent.token,
        { "x-actor-kind": "user" },
      )
    ).status,
  ).toBe(403);
  expect(
    (await worker.request("/formwork/capabilities/alien-form", "PUT", {}, agent.token)).status,
  ).toBe(403);
  await worker.api.auth.revokeToken(agent.id);
  expect((await worker.request("/auth/me", "GET", undefined, agent.token)).status).toBe(401);
});
it("无效草稿保存诊断、未发布不能作为 runtime 来源、首次并发创建只有一个成功", async () => {
  const changes = await Promise.allSettled([
    worker.api.models.saveDraft(
      "incomplete",
      { document: { id: "incomplete" } },
      { ifRevision: null },
    ),
    worker.api.models.saveDraft(
      "incomplete",
      { document: { id: "incomplete", title: "other" } },
      { ifRevision: null },
    ),
  ]);
  expect(changes.filter((change) => change.status === "fulfilled")).toHaveLength(1);
  expect(
    (changes.find((change) => change.status === "rejected") as PromiseRejectedResult).reason.code,
  ).toBe("REVISION_CONFLICT");
  const current = await worker.api.models.read("incomplete");
  expect(current.diagnostics.errors.length).toBeGreaterThan(0);
  await expect(worker.api.runtime.schema("incomplete")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(worker.api.models.draftSchema("incomplete", current.revision)).rejects.toMatchObject(
    { code: "INVALID_MODEL" },
  );
  await expect(worker.api.models.publish("incomplete", current.revision)).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
});
it("草稿 CAS、发布旧审阅 revision 失败，published/runtime 与最新草稿分离", async () => {
  const model = definition("cas");
  await publish(model);
  const current = await worker.api.models.read("cas");
  const changes = await Promise.allSettled([
    worker.api.models.saveDraft(
      "cas",
      draft({ ...model, document: { ...model.document, title: "first" } }),
      { ifRevision: current.revision },
    ),
    worker.api.models.saveDraft(
      "cas",
      draft({ ...model, document: { ...model.document, title: "second" } }),
      { ifRevision: current.revision },
    ),
  ]);
  expect(changes.filter((change) => change.status === "fulfilled")).toHaveLength(1);
  await expect(worker.api.models.publish("cas", current.revision)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect((await worker.api.runtime.schema("cas")).schema.title).toBe("cas");
  expect(await worker.api.models.versions("cas")).toHaveLength(1);
  const saved = await worker.api.models.read("cas");
  const preview = await worker.api.models.preview("cas", "edit", { id: "../record a" });
  expect(new URL(preview.url).searchParams.get("id")).toBe("../record a");
  await expect(worker.api.models.preview("cas", "edit")).rejects.toMatchObject({
    code: "PARAMS_REQUIRED",
  });
  await worker.api.models.publish("cas", saved.revision);
  expect((await worker.api.runtime.schema("cas")).version).toBe(2);
  await expect(worker.api.models.draftSchema("cas", saved.revision)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
});
it("真实记录类型筛选、参数化任意 id、分页、JSON 编码与具体字段错误", async () => {
  const model = definition("records", {
    title: { type: "string" },
    count: { type: "integer", minimum: 1 },
    paid: { type: "boolean" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: { amount: { type: "integer", minimum: 1 } },
        required: ["amount"],
      },
    },
  });
  await publish(model);
  const id = "../record/a b";
  await worker.api.records.create("records", {
    id,
    title: "A%_x",
    count: 2,
    paid: false,
    lines: [{ amount: 3 }],
  });
  await worker.api.records.create("records", { title: "B", count: 5, paid: true });
  expect(await worker.api.records.read("records", id)).toMatchObject({
    id,
    paid: false,
    lines: [{ amount: 3 }],
  });
  expect(
    await worker.api.records.query("records", { filters: { paid: false }, page: 1, pageSize: 10 }),
  ).toMatchObject({ total: 1 });
  expect(
    await worker.api.records.query("records", { filters: { title: "%_" }, page: 1, pageSize: 10 }),
  ).toMatchObject({ total: 1 });
  expect(
    (
      await worker.api.records.query("records", {
        filters: {},
        sort: { field: "count", direction: "desc" },
        page: 1,
        pageSize: 1,
      })
    ).list[0].count,
  ).toBe(5);
  await expect(
    worker.api.records.create("records", { title: "C", lines: [{ amount: 0 }] }),
  ).rejects.toMatchObject({
    code: "INVALID_VALUE",
    issues: expect.arrayContaining([
      expect.objectContaining({ path: "/lines/0/amount", code: "MINIMUM" }),
    ]),
  });
  expect(
    (
      await worker.request("/records/records/query", "POST", {
        filters: { paid: "false" },
        page: 1,
        pageSize: 10,
      })
    ).status,
  ).toBe(400);
  await worker.api.records.update("records", id, { title: "Updated" });
  expect(await worker.api.records.read("records", id)).toMatchObject({
    paid: false,
    count: 2,
    title: "Updated",
  });
});
it("删除字段保留列与值、收紧 required 允许旧记录读取、后续 manifest 不丢历史", async () => {
  const model = definition("retained");
  await publish(model);
  await worker.api.records.create("retained", {
    id: "old",
    title: "Original",
    count: 42,
    paid: true,
  });
  const next = definition("retained", { title: { type: "string" }, extra: { type: "string" } });
  next.document.data.required = ["title", "extra"];
  let current = await worker.api.models.read("retained");
  current = await worker.api.models.saveDraft("retained", next, { ifRevision: current.revision });
  await worker.api.models.publish("retained", current.revision);
  expect(await worker.api.records.read("retained", "old")).toMatchObject({ title: "Original" });
  await expect(
    worker.api.records.update("retained", "old", { title: "Changed" }),
  ).rejects.toMatchObject({ code: "INVALID_VALUE" });
  await worker.api.records.create("retained", { id: "new", title: "New", extra: "x" });
  const sql = await worker.sql("SELECT count, paid FROM test_retained WHERE id = 'old'");
  expect(sql[0].results).toEqual([{ count: 42, paid: 1 }]);
  current = await worker.api.models.read("retained");
  current = await worker.api.models.saveDraft("retained", next, { ifRevision: current.revision });
  await worker.api.models.publish("retained", current.revision);
  const versions = await worker.sql(
    "SELECT storage_manifest_json FROM fw_model_versions WHERE model_id = 'retained' ORDER BY version DESC LIMIT 1",
  );
  expect(JSON.parse(String(versions[0].results[0].storage_manifest_json)).bindings).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "retained:count", active: false })]),
  );
});
it("UNIQUE 失败回滚列、关系 DDL、版本和指针，草稿仍可读回", async () => {
  const model = definition("rollback");
  await publish(model);
  await worker.api.records.create("rollback", { title: "duplicate" });
  await worker.api.records.create("rollback", { title: "duplicate" });
  const next = structuredClone(model);
  next.backend.storage.bindings = next.backend.storage.bindings.map((binding, index) =>
    index === 0 ? { ...binding, index: "unique" } : binding,
  );
  next.document.data.properties.extra = { type: "string" };
  next.backend.storage.bindings = [
    ...next.backend.storage.bindings,
    { id: "rollback:extra", path: "/extra", column: "extra", encoding: "scalar", sqlType: "TEXT" },
  ];
  const current = await worker.api.models.read("rollback");
  const saved = await worker.api.models.saveDraft("rollback", next, {
    ifRevision: current.revision,
  });
  await expect(worker.api.models.publish("rollback", saved.revision)).rejects.toMatchObject({
    code: "STORAGE_INCOMPATIBLE",
  });
  expect((await worker.api.models.read("rollback")).revision).toBe(saved.revision);
  expect(await worker.api.models.versions("rollback")).toHaveLength(1);
  expect(
    (await worker.sql("PRAGMA table_info(test_rollback)"))[0].results.some(
      (column) => column.name === "extra",
    ),
  ).toBe(false);
  expect((await worker.sql("SELECT * FROM fw_commit_guards"))[0].results).toHaveLength(0);
});
it("实际 NOT NULL 遗留列放宽后仍保留旧值，新增记录不被停用字段阻塞", async () => {
  const model = definition("notnull");
  await publish(model);
  await worker.sql(`DROP TABLE test_notnull;
    CREATE TABLE test_notnull(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      creator_id TEXT NOT NULL, data_content TEXT NOT NULL DEFAULT '{}', title TEXT, count INTEGER NOT NULL UNIQUE, paid INTEGER);
    INSERT INTO test_notnull VALUES ('old', '2020', '2020', '${worker.user.id}', '{}', 'Before', 19, 1)`);
  const next = definition("notnull", { title: { type: "string" } });
  const current = await worker.api.models.read("notnull");
  const saved = await worker.api.models.saveDraft("notnull", next, {
    ifRevision: current.revision,
  });
  await worker.api.models.publish("notnull", saved.revision);
  await worker.api.records.create("notnull", { title: "After" });
  expect(
    (await worker.sql("SELECT count FROM test_notnull WHERE id = 'old'"))[0].results[0].count,
  ).toBe(19);
  expect(
    (await worker.sql("PRAGMA table_info(test_notnull)"))[0].results.find(
      (column) => column.name === "count",
    )?.notnull,
  ).toBe(0);
});
it("记录校验后并发发布，新版 guard 拒绝旧提交且 outbox 没有部分写入", async () => {
  const model = definition("race");
  model.backend.behavior.events = { create: ["audit.record"] };
  await publish(model);
  const writing = worker.request(
    "/records/race",
    "POST",
    { id: "racing", title: "old" },
    worker.token,
    { "x-test-gate": "record" },
  );
  await Promise.race([
    worker.waitGate("record"),
    writing.then(async (response) => {
      throw new Error(`记录请求未进入暂停点: ${await response.clone().text()}\n${worker.logs()}`);
    }),
  ]);
  const current = await worker.api.models.read("race");
  const next = structuredClone(model);
  next.document.data.required = ["title", "count"];
  const saved = await worker.api.models.saveDraft("race", next, { ifRevision: current.revision });
  await worker.api.models.publish("race", saved.revision);
  worker.releaseGate("record");
  const response = await writing;
  expect(response.status, worker.logs()).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "SCHEMA_CHANGED" } });
  expect((await worker.sql("SELECT * FROM test_race WHERE id = 'racing'"))[0].results).toHaveLength(
    0,
  );
  expect(
    (await worker.sql("SELECT * FROM fw_outbox WHERE model_id = 'race'"))[0].results,
  ).toHaveLength(0);
});
it("角色子树聚合、own 范围、私有 $ref/required/View 投影与隐藏值更新守恒", async () => {
  const roles = await worker.api.records.query("system-roles", {
    filters: {},
    page: 1,
    pageSize: 20,
  });
  const superRole = String(roles.list[0].id);
  const parent = await worker.api.records.create("system-roles", {
    code: "parent",
    name: "父角色",
    parentId: superRole,
    canCreateModel: false,
  });
  const child = await worker.api.records.create("system-roles", {
    code: "child",
    name: "子角色",
    parentId: parent.id,
    canCreateModel: true,
  });
  await worker.api.records.create("system-users", {
    username: "normal-user",
    password: "local-test-password",
    roleId: [parent.id],
  });
  const plainApi = createFormworkApi({ url: `${worker.origin}/api/v1` });
  const session = await plainApi.auth.login("normal-user", "local-test-password");
  expect(session.user).toMatchObject({ super: false, canCreateModel: true });
  const api = createFormworkApi({ url: `${worker.origin}/api/v1`, token: () => session.token });
  const model = definition("acl", {
    title: { type: "string" },
    paid: { type: "boolean" },
    secret: { $ref: "#/$defs/private" },
  });
  model.document.data.$defs = { private: { type: "string", default: "keep-secret" } };
  model.document.data.required = ["title", "secret"];
  model.backend.permissions = {
    privateFields: ["acl:secret"],
    grants: [
      {
        roleId: String(child.id),
        actions: ["read"],
        fields: ["acl:title", "acl:paid"],
        scope: "own",
      },
      {
        roleId: String(child.id),
        actions: ["create", "update", "delete"],
        fields: ["acl:title"],
        scope: "own",
      },
    ],
  };
  model.document.views = {
    edit: {
      component: "Object",
      field: "",
      children: [
        { component: "Input", field: "/title" },
        { component: "Input", field: "/secret" },
      ],
    },
  };
  await publish(model);
  await worker.api.records.create("acl", { id: "admin-record", title: "Admin", paid: true });
  const runtime = await api.runtime.schema("acl");
  expect(Object.keys(runtime.schema.data.properties)).toEqual(["title", "paid"]);
  expect(runtime.schema.data.properties.paid.readOnly).toBe(true);
  expect(runtime.schema.data.required).toEqual(["title"]);
  expect(runtime.schema.data.$defs).toBeUndefined();
  expect(JSON.stringify(runtime.schema.views)).not.toContain("/secret");
  const own = await api.records.create("acl", { id: "own-record", title: "Own" });
  expect(own.secret).toBeUndefined();
  await api.records.update("acl", "own-record", { title: "Changed" });
  expect(
    (await worker.sql("SELECT secret FROM test_acl WHERE id = 'own-record'"))[0].results[0].secret,
  ).toBe("keep-secret");
  await expect(api.records.update("acl", "own-record", { secret: "hack" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(api.records.update("acl", "own-record", { paid: true })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(api.records.read("acl", "admin-record")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect((await api.records.query("acl", { filters: {}, page: 1, pageSize: 20 })).total).toBe(1);
  await expect(
    api.records.query("acl", { filters: { secret: "keep" }, page: 1, pageSize: 20 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(
    (await api.models.saveDraft("owned_model", definition("owned_model"), { ifRevision: null }))
      .canManage,
  ).toBe(true);
  expect(
    (
      await worker.request(
        "/models/system-hack/draft",
        "PUT",
        { definition: definition("system-hack"), ifRevision: null },
        session.token,
      )
    ).status,
  ).toBe(403);
});
it("关系去重、options、子树、防环、引用删除保护和停用 through 行保留", async () => {
  const target = definition("target");
  await publish(target);
  await worker.api.records.create("target", { id: "t1", title: "Target" });
  const source = definition("relation", {
    title: { type: "string" },
    links: { type: "array", items: { type: "string" } },
  });
  source.backend.relations = [
    {
      fieldId: "relation:links",
      targetModel: "target",
      targetFieldId: "id",
      kind: "many-to-many",
      through: "test_relation_edges",
    },
  ];
  await publish(source);
  await worker.api.records.create("relation", { id: "s1", title: "Source", links: ["t1", "t1"] });
  expect((await worker.api.records.read("relation", "s1")).links).toEqual(["t1"]);
  expect((await worker.sql("SELECT * FROM test_relation_edges"))[0].results).toHaveLength(1);
  await expect(worker.api.records.delete("target", "t1")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    await worker.api.request("/records/relation/options", "POST", { fieldId: "relation:links" }),
  ).toMatchObject({ options: [{ value: "t1", label: "Target" }], total: 1 });
  const roles = await worker.api.records.query("system-roles", {
    filters: {},
    page: 1,
    pageSize: 20,
  });
  const parent = await worker.api.records.create("system-roles", {
    code: "tree_parent",
    name: "父级",
    parentId: roles.list.find((role) => role.code === "super_admin")!.id,
  });
  const child = await worker.api.records.create("system-roles", {
    code: "tree_child",
    name: "子级",
    parentId: parent.id,
  });
  expect(
    await worker.api.request("/records/system-roles/subtree", "POST", {
      idField: "id",
      parentField: "parentId",
      parentValue: parent.id,
    }),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ id: child.id })]));
  await expect(
    worker.api.records.update("system-roles", String(parent.id), { parentId: child.id }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const removed = definition("relation", { title: { type: "string" } });
  const current = await worker.api.models.read("relation");
  const saved = await worker.api.models.saveDraft("relation", removed, {
    ifRevision: current.revision,
  });
  await worker.api.models.publish("relation", saved.revision);
  await worker.api.records.update("relation", "s1", { title: "Updated" });
  expect((await worker.sql("SELECT * FROM test_relation_edges"))[0].results).toHaveLength(1);
  expect(
    (await worker.sql("SELECT links FROM test_relation WHERE id = 's1'"))[0].results[0].links,
  ).toBe('["t1"]');
});
it("官方 SDK stdio 六工具直接调用真实 Worker/D1，agent 只能保存草稿", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const token = await worker.api.auth.issueToken({ label: "真实 MCP", expiresInDays: 1 });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("packages/formwork/dist/stdio.js"), "--url", worker.origin],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      FORMWORK_API_TOKEN: token.token,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "formwork-real-d1-test", version: "1" });
  try {
    await publish(definition("mcp_base"));
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(6);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const value = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(result.isError, JSON.stringify(value)).not.toBe(true);
      return value;
    };
    expect(await call("models.list", {})).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "mcp_base" })]),
    );
    expect(await call("models.read", { modelId: "mcp_base" })).toMatchObject({
      stage: "published",
    });
    expect(
      await call("formwork.capabilities", { modelId: "mcp_base", router: "edit" }),
    ).toMatchObject({ router: "edit", modelId: "mcp_base" });
    const value = definition("mcp_model");
    expect(
      await call("models.validate", { modelId: "mcp_model", definition: value }),
    ).toMatchObject({ errors: [] });
    const saved = await call("models.write", {
      modelId: "mcp_model",
      definition: value,
      ifRevision: null,
    });
    expect(saved).toMatchObject({ stage: "draft", publishedVersion: null, canPublish: false });
    const preview = await call("models.preview", { modelId: "mcp_model", router: "add" });
    expect(new URL(preview.url).searchParams.get("revision")).toBe(saved.revision);
    expect(
      (
        await worker.request(
          "/models/mcp_model/publish",
          "POST",
          { ifRevision: saved.revision },
          token.token,
        )
      ).status,
    ).toBe(403);
  } finally {
    await client.close();
  }
});
it("存储不兼容产生可读草稿诊断，不改变当前版本", async () => {
  const model = definition("incompatible");
  await publish(model);
  const next = structuredClone(model);
  next.document.data.properties.count = { type: "string" };
  next.backend.storage.bindings = next.backend.storage.bindings.map((binding) =>
    binding.id === "incompatible:count" ? { ...binding, sqlType: "TEXT" } : binding,
  );
  const current = await worker.api.models.read("incompatible");
  const saved = await worker.api.models.saveDraft("incompatible", next, {
    ifRevision: current.revision,
  });
  expect(saved.diagnostics.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: "MIGRATION_REQUIRED" })]),
  );
  await expect(worker.api.models.publish("incompatible", saved.revision)).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
  expect((await worker.api.runtime.schema("incompatible")).version).toBe(1);
});
it("并发发布只有一个成功，清单不能删除已发布组件", async () => {
  const model = definition("publishing");
  model.document.views = {
    edit: { component: "Object", field: "", children: [{ component: "Input", field: "/title" }] },
  };
  const saved = await worker.api.models.saveDraft("publishing", model, { ifRevision: null });
  const results = await Promise.allSettled([
    worker.api.models.publish("publishing", saved.revision),
    worker.api.models.publish("publishing", saved.revision),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.code,
  ).toBe("REVISION_CONFLICT");
  const next = manifest();
  for (const capability of Object.values(next.defaultCapabilities))
    capability.components = capability.components.filter((component) => component.name !== "Input");
  const { revision: _revision, ...contents } = next;
  next.revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
  const response = await worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    { revision: next.revision, manifest: next, origin: next.clientOrigin },
    worker.capabilityToken,
  );
  expect(response.status).toBe(422);
});
it("JSON 内容存储、可信命令、batch-delete 与已提交 outbox", async () => {
  const model = definition("json_storage");
  model.backend.storage.bindings = model.backend.storage.bindings.map((binding) =>
    binding.id === "json_storage:title"
      ? {
          id: binding.id,
          path: binding.path,
          jsonKey: "title's key",
          sqlType: "TEXT",
          encoding: "scalar",
          index: "index",
        }
      : binding,
  );
  model.backend.behavior = {
    rules: [],
    commands: { count: "records.count" },
    events: { create: ["audit.record"] },
  };
  await publish(model);
  await worker.api.records.create("json_storage", { id: "json1", title: "Encoded", paid: false });
  expect(
    (
      await worker.api.records.query("json_storage", {
        filters: { title: "code" },
        page: 1,
        pageSize: 10,
      })
    ).total,
  ).toBe(1);
  expect(await worker.api.records.command("json_storage", "count", { filters: {} })).toEqual({
    count: 1,
  });
  const events = (
    await worker.sql(
      "SELECT id, delivered_at, attempts FROM fw_outbox WHERE model_id = 'json_storage'",
    )
  )[0].results;
  expect(events).toHaveLength(1);
  expect(events[0].delivered_at).toBeTypeOf("string");
  expect(events[0].attempts).toBe(1);
  expect(
    await worker.api.request("/records/json_storage/batch-delete", "POST", {
      ids: ["json1", "missing"],
    }),
  ).toMatchObject({ deleted: ["json1"], failed: [{ id: "missing", code: "NOT_FOUND" }] });
});
