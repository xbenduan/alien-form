import { afterAll, beforeAll, expect, it } from "vitest";
import type { ModelDefinition, QueryClause } from "formwork/model";
import type { RecordSnapshot } from "formwork/data";
import { startWorker } from "./worker-harness";

let worker: Awaited<ReturnType<typeof startWorker>>;
beforeAll(async () => {
  worker = await startWorker();
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
  const record = await create("nested_readonly", { info: { name: "初始" } });
  expect(record.data.info).toEqual({ name: "初始", locked: "保持" });
  await expect(create("nested_readonly", { info: { locked: "绕过" } })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    worker.api.records.update({
      modelId: "nested_readonly",
      recordId: record.id,
      ...condition(record),
      changes: { set: { info: { name: "缺少只读值" } } },
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    worker.api.records.update({
      modelId: "nested_readonly",
      recordId: record.id,
      ...condition(record),
      changes: { unset: ["/info"] },
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await worker.api.records.update({
    modelId: "nested_readonly",
    recordId: record.id,
    ...condition(record),
    changes: { set: { info: { name: "修改", locked: "保持" } } },
  });
  expect(
    (await worker.api.records.get({ modelId: "nested_readonly", recordId: record.id })).data.info,
  ).toEqual({
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
  return worker.api.records.query({ modelId: id, query: { clauses, page: 1, pageSize: 100 } });
}
async function create(modelId: string, data: RecordSnapshot["data"]) {
  const model = await worker.api.runtime.schema(modelId);
  return worker.api.records.create({ modelId, data, ifSchemaRevision: model.schemaRevision });
}
function condition(record: RecordSnapshot) {
  return { ifSchemaRevision: record.schemaRevision, ifRecordRevision: record.revision };
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
  const missing = await create("field_values", {
    count: 0,
    paid: false,
    tags: ["b", "", "a"],
    flags: [false, true],
  });
  expect(missing.data.name).toBe("默认名称");
  const loaded = await worker.api.records.get({ modelId: "field_values", recordId: missing.id });
  expect(loaded.data).toMatchObject({
    count: 0,
    paid: false,
    tags: ["b", "", "a"],
    flags: [false, true],
  });
  for (const field of ["note", "jsonNote", "optional"])
    expect(loaded.data).not.toHaveProperty(field);
  const updated = await worker.api.records.update({
    modelId: "field_values",
    recordId: missing.id,
    ...condition(loaded),
    changes: { set: { note: null, jsonNote: null } },
  });
  expect(
    (await worker.api.records.get({ modelId: "field_values", recordId: missing.id })).data,
  ).toMatchObject({
    note: null,
    jsonNote: null,
  });
  expect((await query("field_values", [{ field: "/note", operator: "isNull" }])).total).toBe(1);
  await worker.api.records.update({
    modelId: "field_values",
    recordId: missing.id,
    ...condition(updated),
    changes: { unset: ["/note", "/jsonNote"] },
  });
  expect((await query("field_values", [{ field: "/note", operator: "isNull" }])).total).toBe(0);
  expect(
    (await worker.api.records.get({ modelId: "field_values", recordId: missing.id })).data,
  ).not.toHaveProperty("jsonNote");
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
  await expect(create("field_values", { tags: ["a", "a"] })).rejects.toMatchObject({
    code: "INVALID_VALUE",
  });
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
  await create("numeric_targets", { code: 0, name: "零" });
  await create("numeric_targets", { code: 2, name: "二" });
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
  const record = await create("numeric_sources", { refs: [2, 0], single: 0 });
  expect(
    (await worker.api.records.get({ modelId: "numeric_sources", recordId: record.id })).data.refs,
  ).toEqual([2, 0]);
  const options = await worker.api.records.options({
    modelId: "numeric_sources",
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
  await expect(create("numeric_sources", { refs: [0, 0] })).rejects.toMatchObject({
    code: "INVALID_VALUE",
  });
  await expect(create("numeric_sources", { single: 3 })).rejects.toMatchObject({
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
  const record = await create("stable_fields", { title: "保留值" });
  const current = await worker.api.models.read("stable_fields");
  const renamed = { ...snapshot.definition, data: { heading: snapshot.definition.data.title } };
  const next = await worker.api.models.saveDraft("stable_fields", renamed, {
    ifRevision: current.revision,
  });
  expect(next.diagnostics.errors).toEqual([]);
  await worker.api.models.publish("stable_fields", next.revision);
  expect(
    (await worker.api.records.get({ modelId: "stable_fields", recordId: record.id })).data.heading,
  ).toBe("保留值");
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
    domain: "business-category",
    title: "CMS",
    data: { content: { type: "string", format: "richtext" } },
  });
  expect(cms.definition.data.content.format).toBe("richtext");
  expect((await create("cms_plain", { content: "<b>普通字符串</b>" })).data.content).toBe(
    "<b>普通字符串</b>",
  );
});

it("记录快照阻止旧编辑覆盖，版本缺失拒绝写入，冲突不改变已提交记录", async () => {
  await publish({
    schemaVersion: 1,
    id: "record_cas",
    title: "条件写入",
    data: { title: { type: "string", required: true } },
  });
  const initial = await create("record_cas", { title: "原始值" });
  const modelId = "record_cas",
    recordId = initial.id;
  expect(initial.revision).toBeTruthy();
  const saved = await worker.api.records.update({
    modelId,
    recordId,
    ...condition(initial),
    changes: { set: { title: "新值" } },
  });
  expect(saved.revision).not.toBe(initial.revision);
  await expect(
    worker.api.records.update({
      modelId,
      recordId,
      ...condition(initial),
      changes: { set: { title: "旧页面" } },
    }),
  ).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
  await expect(
    worker.api.records.delete({
      modelId,
      recordId,
      ...condition(initial),
    }),
  ).rejects.toMatchObject({ code: "RECORD_CONFLICT" });
  const noCondition = await worker.request(`/records/${modelId}/${recordId}`, "PATCH", {
    changes: { set: { title: "无条件" } },
  });
  expect(noCondition.status).toBe(428);
  expect(await noCondition.json()).toMatchObject({ error: { code: "PRECONDITION_REQUIRED" } });
  expect((await worker.api.records.get({ modelId, recordId })).data.title).toBe("新值");
  const page = await query(modelId, []);
  expect(page).toMatchObject({ total: 1, items: [saved] });
  expect((await worker.api.runtime.schema(modelId)).capabilities.actions).toEqual({
    read: true,
    create: true,
    update: true,
    delete: true,
  });
  await expect(
    worker.api.records.delete({
      modelId,
      recordId,
      ...condition(saved),
    }),
  ).resolves.toEqual({ id: recordId, deleted: true });
});

it("事务开始前的并发更新仍由D1条件守卫拒绝", async () => {
  const initial = await create("record_cas", { title: "并发起点" });
  const modelId = "record_cas",
    recordId = initial.id;
  const pending = worker.request(
    `/records/${modelId}/${recordId}`,
    "PATCH",
    {
      ...condition(initial),
      changes: { set: { title: "延迟提交" } },
    },
    worker.token,
    { "x-test-gate": "record-cas" },
  );
  await worker.waitGate("record-cas");
  try {
    await worker.api.records.update({
      modelId,
      recordId,
      ...condition(initial),
      changes: { set: { title: "先完成" } },
    });
  } finally {
    worker.releaseGate("record-cas");
  }
  const response = await pending;
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "RECORD_CONFLICT" } });
  expect((await worker.api.records.get({ modelId, recordId })).data.title).toBe("先完成");
});

it("模型重新发布后拒绝旧Schema下的新建、更新和删除", async () => {
  const modelId = "record_cas";
  const initial = await create(modelId, { title: "发布前" });
  const current = await worker.api.models.read(modelId);
  const draft = await worker.api.models.saveDraft(
    modelId,
    {
      ...current.definition,
      title: "新发布名称",
    },
    { ifRevision: current.revision },
  );
  await worker.api.models.publish(modelId, draft.revision);
  const recordId = initial.id;
  await expect(
    worker.api.records.update({
      modelId,
      recordId,
      ...condition(initial),
      changes: { set: { title: "不应写入" } },
    }),
  ).rejects.toMatchObject({ code: "SCHEMA_CONFLICT" });
  await expect(
    worker.api.records.delete({
      modelId,
      recordId,
      ...condition(initial),
    }),
  ).rejects.toMatchObject({ code: "SCHEMA_CONFLICT" });
  await expect(
    worker.api.records.create({
      modelId,
      ifSchemaRevision: initial.schemaRevision,
      data: { title: "旧表单" },
    }),
  ).rejects.toMatchObject({ code: "SCHEMA_CONFLICT" });
  const record = await worker.api.records.get({ modelId, recordId });
  expect(record.revision).toBe(initial.revision);
  expect(record.schemaRevision).not.toBe(initial.schemaRevision);
  expect(record.data.title).toBe("发布前");
});
