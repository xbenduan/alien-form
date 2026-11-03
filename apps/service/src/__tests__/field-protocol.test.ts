import { afterAll, beforeAll, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { frameworkFormats } from "formwork/model";
import type { CapabilityManifest, ModelDefinition, QueryClause } from "formwork/model";
import { startWorker } from "./worker-harness";

let worker: Awaited<ReturnType<typeof startWorker>>;
beforeAll(async () => {
  worker = await startWorker();
  const source = { file: "src/formwork/index.ts", line: 1, column: 1 };
  const layer = {
    components: [
      ...new Set([
        ...Object.values(frameworkFormats).map((format) => format.component),
        "RichText",
      ]),
    ].map((name) => ({ name, source, declaration: name })),
    fn: [],
    runtimeChecks: [],
  };
  const content: Omit<CapabilityManifest, "revision"> = {
    appId: "alien-form",
    formatVersion: 2,
    clientOrigin: "http://localhost:5173",
    presenters: ["page"],
    framework: layer,
    domains: { cms: layer },
    pages: { list: { path: "/list/:modelId", model: true, capabilities: layer, windows: {} } },
  };
  const manifest = {
    ...content,
    revision: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
  };
  const response = await worker.request(
    "/formwork/capabilities/alien-form",
    "PUT",
    {
      revision: manifest.revision,
      manifest,
      origin: manifest.clientOrigin,
    },
    worker.capabilityToken,
  );
  expect(await response.json()).toMatchObject({ registered: true });
}, 60_000);
afterAll(async () => worker?.close());

it("嵌套只读值创建时补默认，更新对象或 unset 不能绕过只读", async () => {
  await publish({
    schemaVersion: 1,
    id: "nested_readonly",
    title: "嵌套只读",
    data: {
      info: {
        type: "object",
        properties: {
          name: { type: "string" },
          locked: { type: "string", readOnly: true, default: "保持" },
        },
      },
    },
  });
  const record = await worker.api.records.create("nested_readonly", { info: { name: "初始" } });
  expect(record.info).toEqual({ name: "初始", locked: "保持" });
  await expect(
    worker.api.records.create("nested_readonly", { info: { locked: "绕过" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    worker.api.records.patch("nested_readonly", String(record.id), {
      set: { info: { name: "缺少只读值" } },
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    worker.api.records.patch("nested_readonly", String(record.id), { unset: ["/info"] }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await worker.api.records.patch("nested_readonly", String(record.id), {
    set: { info: { name: "修改", locked: "保持" } },
  });
  expect((await worker.api.records.read("nested_readonly", String(record.id))).info).toEqual({
    name: "修改",
    locked: "保持",
  });
});

async function publish(definition: ModelDefinition) {
  const draft = await worker.api.models.saveDraft(definition.id, definition, { ifRevision: null });
  expect(draft.diagnostics.errors).toEqual([]);
  return worker.api.models.publish(definition.id, draft.revision);
}
async function query(id: string, clauses: QueryClause[]) {
  return worker.api.records.query(id, { clauses, page: 1, pageSize: 100 });
}

it("统一字段协议往返、创建默认值、原子数组、列和 JSON 的缺失/null 独立", async () => {
  const snapshot = await publish({
    schemaVersion: 1,
    id: "field_values",
    title: "字段语义",
    data: {
      name: { type: "string", required: true, default: "默认名称" },
      note: { type: "string", nullable: true, storage: { column: "note" } },
      jsonNote: { type: "string", nullable: true },
      count: { type: "integer" },
      paid: { type: "boolean" },
      tags: { type: "array", format: "strings", enum: ["", "a", "b"] },
      flags: { type: "array", format: "booleans" },
      optional: {
        type: "object",
        properties: { label: { type: "string", default: "不自动创建对象" } },
      },
    },
  });
  expect(snapshot.definition).not.toHaveProperty("document");
  expect(snapshot.definition.data.name.id).toBeTruthy();
  const missing = await worker.api.records.create("field_values", {
    count: 0,
    paid: false,
    tags: ["b", "", "a"],
    flags: [false, true],
  });
  expect(missing.name).toBe("默认名称");
  const loaded = await worker.api.records.read("field_values", String(missing.id));
  expect(loaded).toMatchObject({
    count: 0,
    paid: false,
    tags: ["b", "", "a"],
    flags: [false, true],
  });
  for (const field of ["note", "jsonNote", "optional"]) expect(loaded).not.toHaveProperty(field);
  await worker.api.records.update("field_values", String(missing.id), {
    note: null,
    jsonNote: null,
  });
  expect(await worker.api.records.read("field_values", String(missing.id))).toMatchObject({
    note: null,
    jsonNote: null,
  });
  expect((await query("field_values", [{ field: "/note", operator: "isNull" }])).total).toBe(1);
  await worker.api.records.patch("field_values", String(missing.id), {
    unset: ["/note", "/jsonNote"],
  });
  expect((await query("field_values", [{ field: "/note", operator: "isNull" }])).total).toBe(0);
  expect(await worker.api.records.read("field_values", String(missing.id))).not.toHaveProperty(
    "jsonNote",
  );
  expect(
    (
      await query("field_values", [
        { field: "/count", operator: "eq", operand: 0 },
        { field: "/paid", operator: "eq", operand: false },
      ])
    ).total,
  ).toBe(1);
  expect(
    (await query("field_values", [{ field: "/tags", operator: "in", operand: [""] }])).total,
  ).toBe(1);
  await expect(
    worker.api.records.create("field_values", { tags: ["a", "a"] }),
  ).rejects.toMatchObject({ code: "INVALID_VALUE" });
  await expect(
    query("field_values", [{ field: "/count", operator: "eq", operand: "0" }]),
  ).rejects.toMatchObject({ code: "INVALID_QUERY" });
  const runtime = await worker.api.runtime.schema("field_values");
  expect(runtime.capabilities.fields["/id"].read).toBe(true);
  expect(runtime.capabilities.fields["/count"].filter).toContain("between");
  expect(runtime.schema.data.note).not.toHaveProperty("storage");
});

it("数字关系批量回显并保持多引用原始顺序", async () => {
  await publish({
    schemaVersion: 1,
    id: "numeric_targets",
    title: "数字目标",
    data: {
      code: { type: "integer", required: true, storage: { index: "unique" } },
      name: { type: "string", required: true },
    },
  });
  await worker.api.records.create("numeric_targets", { code: 0, name: "零" });
  await worker.api.records.create("numeric_targets", { code: 2, name: "二" });
  await publish({
    schemaVersion: 1,
    id: "numeric_sources",
    title: "数字来源",
    data: {
      refs: {
        type: "array",
        format: "numbers",
        items: { type: "integer" },
        relation: { model: "numeric_targets", valueField: "/code" },
      },
      single: { type: "integer", relation: { model: "numeric_targets", valueField: "/code" } },
    },
  });
  const record = await worker.api.records.create("numeric_sources", { refs: [2, 0], single: 0 });
  expect((await worker.api.records.read("numeric_sources", String(record.id))).refs).toEqual([
    2, 0,
  ]);
  const options = await worker.api.records.options("numeric_sources", {
    fieldId: "/refs",
    keyword: "不匹配",
    selectedValues: [0, 2],
  });
  expect(options.options).toEqual(
    expect.arrayContaining([
      { value: 0, label: "零" },
      { value: 2, label: "二" },
    ]),
  );
  await expect(
    worker.api.records.create("numeric_sources", { refs: [0, 0] }),
  ).rejects.toMatchObject({ code: "INVALID_VALUE" });
  await expect(worker.api.records.create("numeric_sources", { single: 3 })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});

it("草稿宽松保存，未知 format 和布局无法发布，字段改名保留存储身份", async () => {
  const snapshot = await publish({
    schemaVersion: 1,
    id: "stable_fields",
    title: "稳定字段",
    data: { title: { type: "string" } },
  });
  const record = await worker.api.records.create("stable_fields", { title: "保留值" });
  const current = await worker.api.models.read("stable_fields");
  const renamed = { ...snapshot.definition, data: { heading: snapshot.definition.data.title } };
  const next = await worker.api.models.saveDraft("stable_fields", renamed, {
    ifRevision: current.revision,
  });
  expect(next.diagnostics.errors).toEqual([]);
  await worker.api.models.publish("stable_fields", next.revision);
  expect((await worker.api.records.read("stable_fields", String(record.id))).heading).toBe(
    "保留值",
  );
  const invalid = await worker.api.models.saveDraft(
    "bad_format",
    {
      schemaVersion: 1,
      id: "bad_format",
      title: "无效预设",
      data: { a: { type: "string", format: "select" } },
      views: {},
    },
    { ifRevision: null },
  );
  expect(invalid.diagnostics.errors.length).toBeGreaterThan(0);
  await expect(worker.api.models.publish("bad_format", invalid.revision)).rejects.toMatchObject({
    code: "INVALID_MODEL",
  });
  const cms = await publish({
    schemaVersion: 1,
    id: "cms_plain",
    domain: "cms",
    title: "CMS",
    data: { content: { type: "string", format: "richtext" } },
  });
  expect(cms.definition.data.content.format).toBe("richtext");
  expect(
    (await worker.api.records.create("cms_plain", { content: "<b>普通字符串</b>" })).content,
  ).toBe("<b>普通字符串</b>");
});
