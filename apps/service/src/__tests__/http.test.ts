import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createFormworkApi } from "formwork/model";
import { toolInputSchemas } from "formwork/mcp";
import type {
  ModelDefinition,
  DraftDefinition,
  CapabilityManifest,
  FieldSchema,
  FormworkApi,
  RecordQuery,
  RecordValue,
} from "formwork/model";
import { startWorker } from "./worker-harness";

let worker: Awaited<ReturnType<typeof startWorker>>;
afterEach(({ task }) => {
  if (task.result?.state === "fail")
    console.error(worker?.logs().split("\n").slice(-35).join("\n"));
});
const baseComponents = [
  "ObjectFields",
  "ArrayFields",
  "Input",
  "Text",
  "NumberInput",
  "Select",
  "Boolean",
  "Null",
  "RichText",
  "FieldOnlyEditor",
];
function manifest(): CapabilityManifest {
  const source = { file: "src/formwork/index.ts", line: 1, column: 1 };
  const components = baseComponents.map((name) => ({
    name,
    source,
    declaration: `(props) => JSX.Element`,
    jsDoc: `渲染 ${name} 字段，props 由框架绑定。`,
  }));
  const contents: Omit<CapabilityManifest, "revision"> = {
    formatVersion: 1,
    appId: "alien-form",
    clientOrigin: "http://localhost:5173",
    app: {
      components,
      formats: [],
      ui: { name: "ui", source, declaration: "FormworkUi" },
      runtimeChecks: [],
    },
    domains: {
      list: {
        transformSchema: {
          name: "transformSchema",
          source: { ...source, file: "src/domains/list/index.tsx" },
          declaration: "(ctx) => ctx",
        },
        runtimeChecks: [],
      },
      "tree-list": { runtimeChecks: [] },
      videos: { runtimeChecks: [] },
    },
    pages: ["models", "model-preview"],
  };
  return {
    ...contents,
    revision: createHash("sha256").update(JSON.stringify(contents)).digest("hex"),
  };
}
function definition(
  id: string,
  properties: Record<string, FieldSchema> = {
    title: { type: "string" },
    count: { type: "integer" },
    paid: { type: "boolean" },
  },
): ModelDefinition & {
  backend: {
    permissions: NonNullable<NonNullable<ModelDefinition["backend"]>["permissions"]>;
    behavior: NonNullable<NonNullable<ModelDefinition["backend"]>["behavior"]>;
  };
} {
  return {
    schemaVersion: 1,
    id,
    title: id,
    data: Object.fromEntries(
      Object.entries(properties).map(([key, field]) => [
        key,
        {
          id: `${id}:${key}`,
          storage: { column: key },
          ...(key === "title" ? { required: true } : {}),
          ...field,
        },
      ]),
    ),
    backend: {
      storage: { table: `test_${id}` },
      permissions: { grants: [], privateFields: [] },
      behavior: { rules: [], commands: {}, events: {} },
    },
  };
}
const draft = (definition: ModelDefinition) => definition as unknown as DraftDefinition;
async function publish(definition: ModelDefinition) {
  const current = await worker.api.models.saveDraft(definition.id, definition, {
    ifRevision: null,
  });
  expect(current.diagnostics.errors).toEqual([]);
  return worker.api.models.publish(definition.id, current.revision);
}
// 业务测试只关心字段值；快照与条件写入协议由 field-protocol.test.ts 单独覆盖。
async function createRecord(modelId: string, data: RecordValue, api: FormworkApi = worker.api) {
  const schema = await api.runtime.schema(modelId);
  return (await api.records.create({ modelId, data, ifSchemaRevision: schema.schemaRevision }))
    .data;
}
async function readRecord(modelId: string, recordId: string, api: FormworkApi = worker.api) {
  return (await api.records.get({ modelId, recordId })).data;
}
async function updateRecord(
  modelId: string,
  recordId: string,
  set: RecordValue,
  api: FormworkApi = worker.api,
) {
  const record = await api.records.get({ modelId, recordId });
  return api.records.update({
    modelId,
    recordId,
    changes: { set },
    ifSchemaRevision: record.schemaRevision,
    ifRecordRevision: record.revision,
  });
}
async function deleteRecord(modelId: string, recordId: string) {
  const record = await worker.api.records.get({ modelId, recordId });
  return worker.api.records.delete({
    modelId,
    recordId,
    ifSchemaRevision: record.schemaRevision,
    ifRecordRevision: record.revision,
  });
}
function queryRecords(modelId: string, query: RecordQuery, api: FormworkApi = worker.api) {
  return api.records.query({ modelId, query });
}
beforeAll(async () => {
  worker = await startWorker({ password: "menu-integration-password" });
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

it("导航固定按账号同步、幂等保留顺序，并发不同模型不覆盖模型与业务状态", async () => {
  const initial = await worker.api.navigation.read();
  expect(initial.systemModels.map(({ id }) => id)).toEqual([
    "system-users",
    "system-roles",
    "system-model-categories",
  ]);
  expect(initial.pinnedModels).toEqual([]);
  await publish(definition("menu_one"));
  await publish(definition("menu_two"));
  const before = await worker.api.models.read("menu_one");
  const events = (await worker.sql("SELECT COUNT(*) AS count FROM fw_outbox"))[0].results;
  const loginApi = createFormworkApi({ url: `${worker.origin}/api/v1` });
  const secondSession = await loginApi.auth.login("integration-admin", "menu-integration-password");
  const second = createFormworkApi({
    url: `${worker.origin}/api/v1`,
    token: () => secondSession.token,
  });
  await Promise.all([
    worker.api.navigation.pinModel("menu_one"),
    second.navigation.pinModel("menu_two"),
  ]);
  expect((await worker.api.navigation.read()).pinnedModels.map(({ id }) => id).sort()).toEqual([
    "menu_one",
    "menu_two",
  ]);
  const rows = (
    await worker.sql("SELECT * FROM fw_model_menu_pins ORDER BY created_at, model_id")
  )[0].results;
  await second.navigation.pinModel("menu_one");
  expect(
    (await worker.sql("SELECT * FROM fw_model_menu_pins ORDER BY created_at, model_id"))[0].results,
  ).toEqual(rows);
  expect((await second.navigation.read()).pinnedModels).toEqual(
    (await worker.api.navigation.read()).pinnedModels,
  );
  expect((await worker.api.models.read("menu_one")).revision).toBe(before.revision);
  expect(await worker.api.models.versions("menu_one")).toHaveLength(1);
  expect((await worker.sql("SELECT COUNT(*) AS count FROM fw_outbox"))[0].results).toEqual(events);
  const renamed = structuredClone(before.definition);
  renamed.title = "未发布名称";
  const saved = await worker.api.models.saveDraft("menu_one", renamed, {
    ifRevision: before.revision,
  });
  expect(
    (await second.navigation.read()).pinnedModels.find(({ id }) => id === "menu_one")?.title,
  ).toBe("menu_one");
  await worker.api.models.publish("menu_one", saved.revision);
  expect(
    (await second.navigation.read()).pinnedModels.find(({ id }) => id === "menu_one")?.title,
  ).toBe("未发布名称");
  await second.navigation.unpinModel("menu_one");
  await second.navigation.unpinModel("menu_one");
  await worker.api.navigation.unpinModel("menu_two");
  expect((await worker.api.navigation.read()).pinnedModels).toEqual([]);
});

it("导航拒绝系统、草稿、agent/deploy；read 与 manage 分离、权限撤销隐藏且可取消失效固定", async () => {
  await worker.api.models.saveDraft("menu_draft", definition("menu_draft"), { ifRevision: null });
  await expect(worker.api.navigation.pinModel("menu_draft")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(worker.api.navigation.pinModel("system-users")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(worker.api.navigation.pinModel("missing_menu")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect((await worker.request("/navigation/pins/Bad", "PUT")).status).toBe(400);
  for (const kind of ["agent", "deploy"] as const) {
    const token = await worker.api.auth.issueToken({
      label: `menu ${kind}`,
      kind,
      expiresInDays: 1,
    });
    for (const [path, method] of [
      ["/navigation", "GET"],
      ["/navigation/pins/menu_draft", "PUT"],
      ["/navigation/pins/menu_draft", "DELETE"],
    ])
      expect((await worker.request(path, method, undefined, token.token)).status).toBe(403);
  }
  const roles = await queryRecords("system-roles", {
    clauses: [],
    page: 1,
    pageSize: 20,
  });
  const role = await createRecord("system-roles", {
    code: "menu_reader",
    name: "菜单读取",
    canCreateModel: true,
    parentId: roles.items.find((value) => value.data.code === "super_admin")!.id,
  });
  const user = await createRecord("system-users", {
    username: "menu-reader",
    password: "menu-reader-password",
    roleId: [role.id],
  });
  const plain = createFormworkApi({ url: `${worker.origin}/api/v1` });
  const login = await plain.auth.login("menu-reader", "menu-reader-password");
  const reader = createFormworkApi({ url: `${worker.origin}/api/v1`, token: () => login.token });
  const model = definition("menu_acl");
  model.backend.permissions.grants = [{ roleId: String(role.id), actions: ["read"], scope: "own" }];
  await publish(model);
  expect((await reader.models.list()).some(({ id }) => id === "menu_acl")).toBe(false);
  expect((await reader.navigation.read()).systemModels).toEqual([]);
  expect((await reader.navigation.read()).pinnableModelIds).toContain("menu_acl");
  await reader.navigation.pinModel("menu_acl");
  expect((await worker.api.navigation.read()).pinnedModels).toEqual([]);
  await reader.models.saveDraft("menu_owned", definition("menu_owned"), { ifRevision: null });
  const own = await reader.models.read("menu_owned");
  await reader.models.publish("menu_owned", own.revision);
  await expect(reader.navigation.pinModel("menu_owned")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const deniedRole = await createRecord("system-roles", {
    code: "menu_denied",
    name: "无菜单权限",
    parentId: roles.items.find((value) => value.data.code === "super_admin")!.id,
  });
  await updateRecord("system-users", String(user.id), { roleId: [deniedRole.id] });
  expect((await reader.navigation.read()).pinnedModels).toEqual([]);
  expect(
    (await worker.sql(`SELECT model_id FROM fw_model_menu_pins WHERE user_id = '${user.id}'`))[0]
      .results,
  ).toEqual([{ model_id: "menu_acl" }]);
  await reader.navigation.unpinModel("menu_acl");
  await reader.navigation.unpinModel("missing_menu");
  expect(
    (await worker.sql(`SELECT model_id FROM fw_model_menu_pins WHERE user_id = '${user.id}'`))[0]
      .results,
  ).toEqual([]);
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
    worker.api.models.saveDraft("incomplete", { id: "incomplete" }, { ifRevision: null }),
    worker.api.models.saveDraft(
      "incomplete",
      { id: "incomplete", title: "other" },
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
    worker.api.models.saveDraft("cas", draft({ ...model, title: "first" }), {
      ifRevision: current.revision,
    }),
    worker.api.models.saveDraft("cas", draft({ ...model, title: "second" }), {
      ifRevision: current.revision,
    }),
  ]);
  expect(changes.filter((change) => change.status === "fulfilled")).toHaveLength(1);
  await expect(worker.api.models.publish("cas", current.revision)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect((await worker.api.runtime.schema("cas")).schema.title).toBe("cas");
  expect(await worker.api.models.versions("cas")).toHaveLength(1);
  const saved = await worker.api.models.read("cas");
  const preview = await worker.api.models.preview("cas", "list");
  expect(new URL(preview.url).pathname).toBe("/model-preview");
  expect(new URL(preview.url).searchParams.get("modelId")).toBe("cas");
  expect(new URL(preview.url).searchParams.get("revision")).toBe(saved.revision);
  await expect(worker.api.models.preview("cas", "missing")).rejects.toMatchObject({
    code: "UNKNOWN_ROUTER",
  });
  const published = await worker.api.models.publish("cas", saved.revision);
  expect((await worker.api.runtime.schema("cas")).schemaRevision).toBe(published.revision);
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
        properties: { amount: { type: "integer", minimum: 1, required: true } },
      },
    },
  });
  await publish(model);
  const id = "../record/a b";
  await createRecord("records", {
    id,
    title: "A%_x",
    count: 2,
    paid: false,
    lines: [{ amount: 3 }],
  });
  await createRecord("records", { title: "B", count: 5, paid: true });
  expect(await readRecord("records", id)).toMatchObject({
    id,
    paid: false,
    lines: [{ amount: 3 }],
  });
  expect(
    await queryRecords("records", {
      clauses: [{ field: "/paid", operator: "eq", operand: false }],
      page: 1,
      pageSize: 10,
    }),
  ).toMatchObject({ total: 1 });
  expect(
    await queryRecords("records", {
      clauses: [{ field: "/title", operator: "contains", operand: "%_" }],
      page: 1,
      pageSize: 10,
    }),
  ).toMatchObject({ total: 1 });
  expect(
    (
      await queryRecords("records", {
        clauses: [],
        sort: { field: "/count", direction: "desc" },
        page: 1,
        pageSize: 1,
      })
    ).items[0].data.count,
  ).toBe(5);
  await expect(
    createRecord("records", { title: "C", lines: [{ amount: 0 }] }),
  ).rejects.toMatchObject({
    code: "INVALID_VALUE",
    issues: expect.arrayContaining([
      expect.objectContaining({ path: "/lines/0/amount", code: "MINIMUM" }),
    ]),
  });
  expect(
    (
      await worker.request("/records/records/query", "POST", {
        clauses: [{ field: "/paid", operator: "eq", operand: "false" }],
        page: 1,
        pageSize: 10,
      })
    ).status,
  ).toBe(422);
  await updateRecord("records", id, { title: "Updated" });
  expect(await readRecord("records", id)).toMatchObject({
    paid: false,
    count: 2,
    title: "Updated",
  });
});
it("新增必填阻止发布，删除字段保留列与值且后续 manifest 不丢历史", async () => {
  const model = definition("retained");
  await publish(model);
  await createRecord("retained", {
    id: "old",
    title: "Original",
    count: 42,
    paid: true,
  });
  const next = definition("retained", { title: { type: "string" }, extra: { type: "string" } });
  next.data.extra!.required = true;
  let current = await worker.api.models.read("retained");
  current = await worker.api.models.saveDraft("retained", next, { ifRevision: current.revision });
  expect(current.diagnostics.errors).toContainEqual(
    expect.objectContaining({ code: "SCHEMA_INCOMPATIBLE" }),
  );
  await expect(worker.api.models.publish("retained", current.revision)).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
  delete next.data.extra!.required;
  current = await worker.api.models.saveDraft("retained", next, { ifRevision: current.revision });
  await worker.api.models.publish("retained", current.revision);
  expect(await readRecord("retained", "old")).toMatchObject({ title: "Original" });
  await updateRecord("retained", "old", { title: "Changed" });
  await createRecord("retained", { id: "new", title: "New", extra: "x" });
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
  await createRecord("rollback", { title: "duplicate" });
  await createRecord("rollback", { title: "duplicate" });
  const next = structuredClone(model);
  next.data.title!.storage = { column: "title", index: "unique" };
  next.data.extra = { id: "rollback:extra", type: "string", storage: { column: "extra" } };
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
it("记录校验后并发发布，新版 guard 拒绝旧提交且 outbox 没有部分写入", async () => {
  const model = definition("race");
  model.backend.behavior.events = { create: ["audit.record"] };
  const published = await publish(model);
  const writing = worker.request(
    "/records/race",
    "POST",
    { data: { id: "racing", title: "old" }, ifSchemaRevision: published.revision },
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
  next.data.count!.required = true;
  const saved = await worker.api.models.saveDraft("race", next, { ifRevision: current.revision });
  await worker.api.models.publish("race", saved.revision);
  worker.releaseGate("record");
  const response = await writing;
  expect(response.status, worker.logs()).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "SCHEMA_CONFLICT" } });
  expect((await worker.sql("SELECT * FROM test_race WHERE id = 'racing'"))[0].results).toHaveLength(
    0,
  );
  expect(
    (await worker.sql("SELECT * FROM fw_outbox WHERE model_id = 'race'"))[0].results,
  ).toHaveLength(0);
});
it("角色子树聚合、own 范围、私有字段投影与隐藏值更新守恒", async () => {
  const roles = await queryRecords("system-roles", {
    clauses: [],
    page: 1,
    pageSize: 20,
  });
  const superRole = String(roles.items[0].id);
  const parent = await createRecord("system-roles", {
    code: "parent",
    name: "父角色",
    parentId: superRole,
    canCreateModel: false,
  });
  const child = await createRecord("system-roles", {
    code: "child",
    name: "子角色",
    parentId: parent.id,
    canCreateModel: true,
  });
  await createRecord("system-users", {
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
    parentId: { type: "string", nullable: true },
  });
  model.$defs = { private: { type: "string", default: "keep-secret" } };
  model.data.secret!.required = true;
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
  model.data.title!.props = { placeholder: "可见标题" };
  model.data.secret!.ui = { form: { component: "RichText" }, table: false };
  model.data.parentId!.ui = { filter: false };
  model.tree = { parentField: "/parentId", labelField: "/title" };
  model.data.parentId!.relation = { model: "acl", labelField: "/title" };
  await publish(model);
  await createRecord("acl", { id: "admin-record", title: "Admin", paid: true });
  const runtime = await api.runtime.schema("acl");
  expect(Object.keys(runtime.schema.data)).toEqual([
    "id",
    "createdAt",
    "updatedAt",
    "creatorId",
    "title",
    "paid",
  ]);
  expect(runtime.schema.data.paid!.readOnly).toBe(true);
  expect(runtime.schema.data.title!.required).toBe(true);
  expect(runtime.schema.$defs).toBeUndefined();
  expect(JSON.stringify(runtime.schema)).not.toContain("secret");
  expect(runtime.schema.data.title!.props).toEqual(model.data.title!.props);
  expect(runtime.schema.tree).toBeUndefined();
  const own = await createRecord("acl", { id: "own-record", title: "Own" }, api);
  expect(own.secret).toBeUndefined();
  await updateRecord("acl", "own-record", { title: "Changed" }, api);
  expect(
    (await worker.sql("SELECT secret FROM test_acl WHERE id = 'own-record'"))[0].results[0].secret,
  ).toBe("keep-secret");
  await expect(updateRecord("acl", "own-record", { secret: "hack" }, api)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(updateRecord("acl", "own-record", { paid: true }, api)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(readRecord("acl", "admin-record", api)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect((await queryRecords("acl", { clauses: [], page: 1, pageSize: 20 }, api)).total).toBe(1);
  await expect(
    queryRecords(
      "acl",
      {
        clauses: [{ field: "/secret", operator: "contains", operand: "keep" }],
        page: 1,
        pageSize: 20,
      },
      api,
    ),
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
it("字段按 app 共享能力诊断组件，props 按普通 JSON 保留", async () => {
  const model = definition("field_capabilities");
  model.data.title!.ui = { form: { component: "MissingEditor" } };
  model.data.title!.props = { placeholder: "{{ fn.missingHint() }}" };
  const saved = await worker.api.models.saveDraft("field_capabilities", model, {
    ifRevision: null,
  });
  expect(saved.diagnostics.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: "/data/title",
        code: "UNKNOWN_COMPONENT",
        modelId: "field_capabilities",
      }),
    ]),
  );
  await expect(
    worker.api.models.publish("field_capabilities", saved.revision),
  ).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
  model.data.title!.ui = { form: { component: "Input" } };
  model.data.title!.props = { placeholder: "请输入标题" };
  const valid = await worker.api.models.saveDraft("field_capabilities", model, {
    ifRevision: saved.revision,
  });
  expect(valid.diagnostics.errors).toEqual([]);
  expect(valid.diagnostics.runtimeChecks).toEqual([]);
  await worker.api.models.publish("field_capabilities", valid.revision);
  expect((await worker.api.runtime.schema("field_capabilities")).schema.data.title!.props).toEqual(
    model.data.title!.props,
  );
});
it("首次发布自关联树，parentId 与 subtree 使用指定父字段且保留直系子级语义", async () => {
  const model = definition("field_tree", {
    title: { type: "string" },
    otherParent: { type: "string", nullable: true },
    parentId: { type: "string", nullable: true },
  });
  model.tree = { parentField: "/parentId", labelField: "/title" };
  model.data.parentId!.storage = { jsonKey: "tree_parent" };
  for (const key of ["otherParent", "parentId"])
    model.data[key]!.relation = { model: "field_tree", labelField: "/title" };
  const invalid = structuredClone(model);
  delete invalid.data.parentId!.relation;
  const current = await worker.api.models.saveDraft("field_tree", invalid, { ifRevision: null });
  expect(current.diagnostics.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "/tree/parentField", code: "INVALID_MODEL" }),
    ]),
  );
  const saved = await worker.api.models.saveDraft("field_tree", model, {
    ifRevision: current.revision,
  });
  expect(saved.diagnostics.errors).toEqual([]);
  await worker.api.models.publish("field_tree", saved.revision);
  for (const record of [
    { id: "tree-root", title: "Root" },
    { id: "tree-child", title: "Child", parentId: "tree-root" },
    { id: "tree-grandchild", title: "Grandchild", parentId: "tree-child" },
    { id: "tree-other", title: "Other", otherParent: "tree-root" },
  ] as RecordValue[])
    await createRecord("field_tree", record);
  const direct = await queryRecords("field_tree", {
    clauses: [],
    parentId: "tree-root",
    page: 1,
    pageSize: 20,
  });
  expect(direct.items.map((record) => record.id)).toEqual(["tree-child"]);
  expect(direct.total).toBe(1);
  expect(
    (
      await worker.api.request<RecordValue[]>("/records/field_tree/subtree", "POST", {
        parentField: "parentId",
        parentValue: "tree-root",
      })
    )
      .map((record) => record.id)
      .sort(),
  ).toEqual(["tree-child", "tree-grandchild"]);
  expect(
    (
      await worker.api.request<RecordValue[]>("/records/field_tree/subtree", "POST", {
        parentField: "otherParent",
        parentValue: "tree-root",
      })
    ).map((record) => record.id),
  ).toEqual(["tree-other"]);
  expect(
    await worker.api.request("/records/field_tree/subtree", "POST", { parentField: "parentId" }),
  ).toHaveLength(4);
  await expect(
    updateRecord("field_tree", "tree-root", { parentId: "tree-grandchild" }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await createRecord("field_tree", { id: "tree-race-a", title: "A" });
  await createRecord("field_tree", { id: "tree-race-b", title: "B" });
  const treeRecord = await worker.api.records.get({
    modelId: "field_tree",
    recordId: "tree-race-a",
  });
  const writing = worker.request(
    "/records/field_tree/tree-race-a",
    "PATCH",
    {
      changes: { set: { parentId: "tree-race-b" } },
      ifSchemaRevision: treeRecord.schemaRevision,
      ifRecordRevision: treeRecord.revision,
    },
    worker.token,
    { "x-test-gate": "tree-record" },
  );
  await Promise.race([
    worker.waitGate("tree-record"),
    writing.then(async (response) => {
      throw new Error(`树记录请求未进入暂停点: ${await response.clone().text()}`);
    }),
  ]);
  try {
    await updateRecord("field_tree", "tree-race-b", { parentId: "tree-race-a" });
  } finally {
    worker.releaseGate("tree-record");
  }
  expect(await (await writing).json()).toMatchObject({ error: { code: "RECORD_CONFLICT" } });
  expect((await readRecord("field_tree", "tree-race-a")).parentId).toBeUndefined();
});
it("关系去重、options、子树、防环、引用删除保护和停用 through 行保留", async () => {
  const target = definition("target");
  await publish(target);
  await createRecord("target", { id: "t1", title: "Target" });
  const source = definition("relation", {
    title: { type: "string" },
    links: { type: "array", items: { type: "string" } },
  });
  source.data.links!.relation = { model: "target", labelField: "/title" };
  source.data.links!.storage = { column: "links", through: "test_relation_edges" };
  await publish(source);
  await expect(
    createRecord("relation", {
      id: "duplicate",
      title: "Source",
      links: ["t1", "t1"],
    }),
  ).rejects.toMatchObject({ code: "INVALID_VALUE" });
  await createRecord("relation", { id: "s1", title: "Source", links: ["t1"] });
  expect((await readRecord("relation", "s1")).links).toEqual(["t1"]);
  expect((await worker.sql("SELECT * FROM test_relation_edges"))[0].results).toHaveLength(1);
  await expect(deleteRecord("target", "t1")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    await worker.api.records.options({ modelId: "relation", fieldId: "relation:links" }),
  ).toMatchObject({ options: [{ value: "t1", label: "Target" }], total: 1 });
  const roles = await queryRecords("system-roles", {
    clauses: [],
    page: 1,
    pageSize: 20,
  });
  const parent = await createRecord("system-roles", {
    code: "tree_parent",
    name: "父级",
    parentId: roles.items.find((role) => role.data.code === "super_admin")!.id,
  });
  const child = await createRecord("system-roles", {
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
    updateRecord("system-roles", String(parent.id), { parentId: child.id }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const removed = definition("relation", { title: { type: "string" } });
  const current = await worker.api.models.read("relation");
  const saved = await worker.api.models.saveDraft("relation", removed, {
    ifRevision: current.revision,
  });
  await worker.api.models.publish("relation", saved.revision);
  await updateRecord("relation", "s1", { title: "Updated" });
  expect((await worker.sql("SELECT * FROM test_relation_edges"))[0].results).toHaveLength(1);
  expect(
    (await worker.sql("SELECT links FROM test_relation WHERE id = 's1'"))[0].results[0].links,
  ).toBe('["t1"]');
});
it("官方 SDK 通过 HTTP 和自定义 Headers 调用真实 Worker/D1 工具，agent 只能保存草稿", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } =
    await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const token = await worker.api.auth.issueToken({ label: "真实 MCP", expiresInDays: 1 });
  const transport = new StreamableHTTPClientTransport(new URL(`${worker.origin}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token.token}` } },
  });
  const client = new Client({ name: "formwork-real-d1-test", version: "1" });
  try {
    await publish(definition("mcp_base"));
    await client.connect(transport);
    expect(transport.sessionId).toBeUndefined();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
      Object.keys(toolInputSchemas),
    );
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
      await call("formwork.capabilities", { modelId: "mcp_base", router: "list" }),
    ).toMatchObject({ router: "list", modelId: "mcp_base" });
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
    const preview = await call("models.preview", {
      modelId: "mcp_model",
      router: "list",
    });
    expect(new URL(preview.url).searchParams.get("revision")).toBe(saved.revision);
    expect(new URL(preview.url).searchParams.get("router")).toBe("list");
    const conflict = await client.callTool({
      name: "models.write",
      arguments: { modelId: "mcp_model", definition: value, ifRevision: null },
    });
    expect(conflict.isError).toBe(true);
    expect(JSON.parse((conflict.content as Array<{ text: string }>)[0].text)).toMatchObject({
      error: { code: "REVISION_CONFLICT", currentRevision: saved.revision },
    });
    const incomplete = await call("models.write", {
      modelId: "mcp_incomplete",
      definition: { id: "mcp_incomplete" },
      ifRevision: null,
    });
    expect(incomplete.diagnostics.errors.length).toBeGreaterThan(0);
    expect(await call("models.read", { modelId: "mcp_incomplete" })).toMatchObject({
      stage: "draft",
      revision: incomplete.revision,
      diagnostics: incomplete.diagnostics,
    });
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
it("无项目上下文的 MCP agent 从握手、零参数工具和资源发现完整能力，再用返回模板构建草稿", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } =
    await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const token = await worker.api.auth.issueToken({ label: "零上下文 MCP", expiresInDays: 1 });
  const client = new Client({ name: "no-project-context-agent", version: "1" });
  const call = async (name: string, args?: Record<string, unknown>) => {
    const result = await client.callTool({ name, ...(args ? { arguments: args } : {}) });
    const value = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(result.isError, JSON.stringify(value)).not.toBe(true);
    return value;
  };
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${worker.origin}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token.token}` } },
      }),
    );
    expect(client.getInstructions()).toContain("formwork.describe({})");
    expect(client.getInstructions()).toContain("data 是字段 map");
    expect(client.getServerCapabilities()).toMatchObject({ tools: {}, resources: {} });
    const tools = (await client.listTools()).tools;
    for (const name of ["formwork.describe", "formwork.capabilities"]) {
      const tool = tools.find((item) => item.name === name)!;
      expect(tool.inputSchema.required ?? []).toEqual([]);
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.description).toContain("{}");
    }
    expect(tools.find((item) => item.name === "models.write")!.annotations?.readOnlyHint).toBe(
      false,
    );
    const info = await call("formwork.describe");
    expect(info.permissions).toEqual({
      canCreateModel: true,
      canPublishViaMcp: false,
      systemModelsReadOnly: true,
    });
    expect(info.definitionJsonSchema.properties.data).toBeDefined();
    expect(info.guide.definition).toBeDefined();
    expect(info.backendCapabilities.commands).toContain("records.count");
    const catalog = await call("formwork.capabilities");
    expect(catalog).toEqual(info.capabilities);
    expect(catalog).toMatchObject({
      scope: "application",
      transformOrder: ["app", "Domain", "local"],
      app: {
        components: expect.arrayContaining([
          expect.objectContaining({
            name: "Input",
            declaration: expect.any(String),
            jsDoc: expect.any(String),
            source: expect.any(Object),
          }),
        ]),
      },
      domains: {
        list: { transformSchema: expect.objectContaining({ declaration: "(ctx) => ctx" }) },
      },
      pages: ["models", "model-preview"],
    });
    expect(catalog.targets).toContainEqual(
      expect.objectContaining({
        router: "list",
        path: "/list/:modelId",
        model: true,
      }),
    );
    const resources = (await client.listResources()).resources;
    expect(resources.map((item) => item.uri).sort()).toEqual(info.resources.toSorted());
    for (const uri of info.resources) {
      const resource = await client.readResource({ uri });
      expect(resource.contents[0]).toMatchObject({ uri, mimeType: "application/json" });
      const value = JSON.parse((resource.contents[0] as { text: string }).text);
      if (uri === "formwork://definition-schema") expect(value).toEqual(info.definitionJsonSchema);
      if (uri === "formwork://capabilities") expect(value).toEqual(catalog);
      if (uri === "formwork://guide") expect(value.guide).toEqual(info.guide);
    }
    const scoped = await call(
      info.examples.effectiveCapabilities.name,
      info.examples.effectiveCapabilities.arguments,
    );
    expect(scoped.components.some((item: { name: string }) => item.name === "Input")).toBe(true);
    const withDomain = await call("formwork.capabilities", {
      ...info.examples.effectiveCapabilities.arguments,
      router: "tree-list",
    });
    expect(withDomain.components).toEqual(scoped.components);
    expect(withDomain.router).toBe("tree-list");
    const validated = await call(info.examples.validate.name, info.examples.validate.arguments);
    expect(validated.errors).toEqual([]);
    const saved = await call(info.examples.create.name, info.examples.create.arguments);
    expect(saved).toMatchObject({
      stage: "draft",
      definition: info.definitionTemplate,
      diagnostics: { errors: [] },
    });
    const preview = await call(info.examples.preview.name, info.examples.preview.arguments);
    expect(new URL(preview.url).searchParams.get("revision")).toBe(saved.revision);
    const incompleteTarget = await client.callTool({
      name: "formwork.capabilities",
      arguments: { router: "list" },
    });
    expect(incompleteTarget.isError).toBe(true);
    expect(JSON.stringify(incompleteTarget.content)).toContain("发现全部组件请传 {}");
    const revision = saved.revision;
    const changed = structuredClone(saved.definition);
    changed.title = "agent 更新的模型";
    const updated = await call("models.write", {
      modelId: saved.id,
      definition: changed,
      ifRevision: revision,
    });
    expect(updated.revision).not.toBe(revision);
    expect((await call("models.read", { modelId: saved.id })).definition.title).toBe(
      "agent 更新的模型",
    );
  } finally {
    await client.close();
  }
});
it("未登记能力清单时 MCP 仍能提供构建指南和 schema，并明确返回部署状态", async () => {
  const revision = manifest().revision;
  await worker.sql("DELETE FROM fw_capability_heads WHERE app_id = 'alien-form'");
  const invoke = async (name: string) => {
    const response = await fetch(`${worker.origin}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${worker.token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: {} },
      }),
    });
    return (
      (await response.json()) as {
        result: { isError?: boolean; content: { text: string }[] };
      }
    ).result;
  };
  try {
    const described = await invoke("formwork.describe");
    expect(described.isError).not.toBe(true);
    const info = JSON.parse(described.content[0].text);
    expect(info).toMatchObject({
      capabilities: null,
      capabilitiesError: { code: "CAPABILITIES_UNAVAILABLE" },
      definitionTemplate: { schemaVersion: 1, id: expect.any(String), data: expect.any(Object) },
      definitionJsonSchema: { type: "object" },
    });
    expect(info.setup).toContain("pnpm capabilities:register");
    expect((await invoke("formwork.capabilities")).isError).toBe(true);
  } finally {
    await worker.sql(
      `INSERT INTO fw_capability_heads(app_id, revision) VALUES ('alien-form', '${revision}')`,
    );
  }
});
it("MCP 每次请求校验 Header credential，拒绝 URL token、deploy、过期及已撤销凭证", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } =
    await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const token = await worker.api.auth.issueToken({ label: "MCP 撤销", expiresInDays: 1 });
  const request = (headers: Record<string, string> = {}, query = "") =>
    fetch(`${worker.origin}/mcp${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
  expect((await request()).status).toBe(401);
  expect((await request({ Authorization: "Bearer invalid" })).status).toBe(401);
  expect((await request({}, `?token=${encodeURIComponent(token.token)}`)).status).toBe(401);
  expect((await request({ Authorization: `Bearer ${worker.capabilityToken}` })).status).toBe(403);
  const expired = await worker.api.auth.issueToken({ label: "MCP 过期", expiresInDays: 1 });
  await worker.sql(
    `UPDATE fw_credentials SET expires_at = '2000-01-01' WHERE id = '${expired.id}'`,
  );
  expect((await request({ Authorization: `Bearer ${expired.token}` })).status).toBe(401);
  const client = new Client({ name: "formwork-mcp-revocation-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(`${worker.origin}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token.token}` } },
  });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(Object.keys(toolInputSchemas).length);
    await worker.api.auth.revokeToken(token.id);
    expect((await request({ Authorization: `Bearer ${token.token}` })).status).toBe(401);
    await expect(client.listTools()).rejects.toMatchObject({ code: 401 });
  } finally {
    await client.close();
  }
});
it("MCP 校验 Origin、协议和请求大小，并允许携带鉴权及协议 Header 的 CORS 预检", async () => {
  const headers = {
    Authorization: `Bearer ${worker.token}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  const list = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const request = (body: string, extra: Record<string, string> = {}) =>
    fetch(`${worker.origin}/mcp`, { method: "POST", headers: { ...headers, ...extra }, body });
  expect((await request(list, { Origin: "https://untrusted.example" })).status).toBe(403);
  const preflight = await fetch(`${worker.origin}/mcp`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,mcp-protocol-version",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  expect(preflight.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain(
    "mcp-protocol-version",
  );
  const response = await request(list, {
    Origin: "http://localhost:5173",
    "MCP-Protocol-Version": "2025-03-26",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("application/json");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Mcp-Session-Id")).toBeNull();
  expect((await request(list, { "MCP-Protocol-Version": "invalid" })).status).toBe(400);
  expect((await request("{")).status).toBe(400);
  expect((await request(JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) }))).status).toBe(
    413,
  );
  expect((await fetch(`${worker.origin}/mcp`, { headers })).status).toBe(405);
  expect((await fetch(`${worker.origin}/mcp`, { method: "DELETE", headers })).status).toBe(405);
});
it("存储不兼容产生可读草稿诊断，不改变当前版本", async () => {
  const model = definition("incompatible");
  await publish(model);
  const next = structuredClone(model);
  next.data.count!.type = "string";
  const current = await worker.api.models.read("incompatible");
  const saved = await worker.api.models.saveDraft("incompatible", next, {
    ifRevision: current.revision,
  });
  expect(saved.diagnostics.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: "STORAGE_INCOMPATIBLE" })]),
  );
  await expect(worker.api.models.publish("incompatible", saved.revision)).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
  expect(await worker.api.models.versions("incompatible")).toHaveLength(1);
});
it("并发发布只有一个成功，清单不能删除已发布组件", async () => {
  const model = definition("publishing");
  model.data.title!.ui = { form: { component: "Input" } };
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
  next.app.components = next.app.components.filter((component) => component.name !== "Input");
  const { revision: _revision, ...contents } = next;
  next.revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
  const response = await worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    { revision: next.revision, manifest: next, origin: next.clientOrigin },
    worker.capabilityToken,
  );
  expect(response.status).toBe(422);
  const fieldModel = definition("published_field");
  fieldModel.data.title!.ui = { form: { component: "FieldOnlyEditor" } };
  await publish(fieldModel);
  const withoutFieldComponent = manifest();
  withoutFieldComponent.app.components = withoutFieldComponent.app.components.filter(
    (component) => component.name !== "FieldOnlyEditor",
  );
  const { revision: _fieldRevision, ...fieldContents } = withoutFieldComponent;
  withoutFieldComponent.revision = createHash("sha256")
    .update(JSON.stringify(fieldContents))
    .digest("hex");
  const fieldResponse = await worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    {
      revision: withoutFieldComponent.revision,
      manifest: withoutFieldComponent,
      origin: withoutFieldComponent.clientOrigin,
    },
    worker.capabilityToken,
  );
  expect(fieldResponse.status).toBe(422);
  expect(await fieldResponse.json()).toMatchObject({
    error: {
      code: "INVALID_MODEL",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "UNKNOWN_COMPONENT",
          path: "/data/title",
        }),
      ]),
    },
  });
});
it("JSON 内容存储、可信命令、条件删除与已提交 outbox", async () => {
  const model = definition("json_storage");
  model.data.title!.storage = { jsonKey: "title's key", index: "index" };
  model.backend.behavior = {
    rules: [],
    commands: { count: "records.count" },
    events: { create: ["audit.record"] },
  };
  await publish(model);
  await createRecord("json_storage", { id: "json1", title: "Encoded", paid: false });
  expect(
    (
      await queryRecords("json_storage", {
        clauses: [{ field: "/title", operator: "contains", operand: "code" }],
        page: 1,
        pageSize: 10,
      })
    ).total,
  ).toBe(1);
  expect(
    await worker.api.request("/records/json_storage/commands/count", "POST", { clauses: [] }),
  ).toEqual({
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
  expect(await deleteRecord("json_storage", "json1")).toEqual({ id: "json1", deleted: true });
  expect((await queryRecords("json_storage", { clauses: [], page: 1, pageSize: 10 })).total).toBe(
    0,
  );
});

it("router 显式选择 Domain，共享 app 能力不受业务 domain 分类影响", async () => {
  for (const id of ["shared_a", "shared_b"]) {
    const model = definition(id);
    model.domain = `business-${id}`;
    model.data.title!.ui = { form: { component: "Input" } };
    await publish(model);
    const capability = await worker.api.capabilities(id, "list");
    expect(capability).toMatchObject({
      modelId: id,
      router: "list",
    });
    expect(capability.components.some((item) => item.name === "Input")).toBe(true);
    const tree = await worker.api.capabilities(id, "tree-list");
    expect(tree.components).toEqual(capability.components);
    expect(tree.router).toBe("tree-list");
  }
  const category = definition("candidate_domain");
  category.domain = "unregistered-business-category";
  const saved = await worker.api.models.saveDraft("candidate_domain", category, {
    ifRevision: null,
  });
  expect(saved.diagnostics.errors).toEqual([]);
  expect(await worker.api.capabilities("candidate_domain", "list")).toMatchObject({
    modelId: "candidate_domain",
    router: "list",
  });
  const fallback = await worker.api.capabilities("unregistered_model", "list");
  expect(fallback.components.some((item) => item.name === "Input")).toBe(true);
  for (const router of ["missing", "models"]) {
    await expect(worker.api.capabilities("candidate_domain", router)).rejects.toMatchObject({
      code: "UNKNOWN_ROUTER",
    });
  }
  const layoutInSchema = { ...definition("layout_in_schema"), pages: {} };
  expect(
    (await worker.api.models.validate("layout_in_schema", layoutInSchema)).errors,
  ).toContainEqual(
    expect.objectContaining({
      code: "INVALID_MODEL",
      path: "/pages",
    }),
  );
  const withoutDomain = manifest();
  delete withoutDomain.domains["tree-list"];
  try {
    expect((await register(withoutDomain)).status).toBe(200);
    await expect(worker.api.capabilities("candidate_domain", "tree-list")).rejects.toMatchObject({
      code: "UNKNOWN_ROUTER",
    });
    expect((await worker.api.runtime.schema("shared_a")).schema.domain).toBe("business-shared_a");
  } finally {
    expect((await register(manifest())).status).toBe(200);
  }
});

function register(value: CapabilityManifest, gate?: string) {
  const { revision: _revision, ...contents } = value;
  value.revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
  return worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    { revision: value.revision, manifest: value, origin: value.clientOrigin },
    worker.capabilityToken,
    gate ? { "x-test-gate": gate } : {},
  );
}

it("清单在校验后变化时，发布事务拒绝旧能力判断", async () => {
  const model = definition("capability_race");
  model.data.title!.ui = { form: { component: "Text" } };
  const draft = await worker.api.models.saveDraft(model.id, model, { ifRevision: null });
  const pending = worker.request(
    `/models/${model.id}/publish`,
    "POST",
    { ifRevision: draft.revision },
    worker.token,
    { "x-test-gate": "publish-capability" },
  );
  await Promise.race([
    worker.waitGate("publish-capability"),
    pending.then(async (response) => {
      throw new Error(await response.clone().text());
    }),
  ]);
  try {
    const next = manifest();
    next.app.components = next.app.components.filter((item) => item.name !== "Text");
    expect((await register(next)).status).toBe(200);
  } finally {
    worker.releaseGate("publish-capability");
  }
  try {
    const response = await pending;
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
    expect(await worker.api.models.versions(model.id)).toEqual([]);
  } finally {
    expect((await register(manifest())).status).toBe(200);
  }
});

it("校验清单后出现新发布版本，登记事务保留原清单并要求重试", async () => {
  const next = manifest();
  next.app.components = next.app.components.filter((item) => item.name !== "Text");
  const pending = register(next, "register-capability");
  await Promise.race([
    worker.waitGate("register-capability"),
    pending.then(async (response) => {
      throw new Error(await response.clone().text());
    }),
  ]);
  try {
    const current = await worker.api.models.read("capability_race");
    await worker.api.models.publish(current.id, current.revision);
  } finally {
    worker.releaseGate("register-capability");
  }
  const response = await pending;
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
  const effective = await worker.api.capabilities("capability_race", "list");
  expect(effective.components.some((item) => item.name === "Text")).toBe(true);
  expect((await register(next)).status).toBe(422);
  expect((await worker.sql("SELECT * FROM fw_commit_guards"))[0].results).toEqual([]);
});
