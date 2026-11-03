import { expect, it } from "vitest";
import { z } from "zod";
import {
  assignFieldIds,
  baseFieldSchema,
  compileDefinition,
  migrateLegacyDefinition,
  modelIssues,
  resolveModel,
} from "../index";
import type { ModelDefinition } from "../index";

const document = (data: ModelDefinition["data"]): ModelDefinition => ({
  schemaVersion: 1,
  id: "sample",
  title: "Sample",
  data,
});

it("format 契约校验 type、候选冲突、受控 props 和真实数组", () => {
  for (const data of [
    { field: { type: "string", format: "strings" } },
    { field: { type: "string", format: "select" } },
    { field: { type: "string", format: "missing" } },
    { field: { type: "boolean", enum: [false, false] } },
    { field: { type: "string", enum: ["a"], relation: { model: "target" } } },
    { field: { type: "string", props: { scene: "table" } } },
  ] as ModelDefinition["data"][])
    expect(modelIssues(document(data)).length).toBeGreaterThan(0);
  const schema = document({
    scores: { type: "array", format: "numbers", enum: [0, 1] },
    answer: { type: "string", enum: ["是", "否", null] },
  });
  expect(modelIssues(schema)).toEqual([]);
  const model = resolveModel(schema);
  expect(model.field("/scores").schema.items?.type).toBe("number");
  expect(model.field("/scores/0").schema.type).toBe("number");
  expect(model.field("/answer").valueSchema).toMatchObject({
    type: ["string", "null"],
    enum: ["是", "否", null],
  });
});

it("共享 valueSchema 按实际数组地址验证，默认值不能绕过 format", () => {
  const contract = {
    formats: {
      short: {
        component: "Input",
        schema: baseFieldSchema,
        valueSchema: z.string().max(3),
      },
    },
  };
  const schema = document({
    rows: { type: "array", format: "array", items: { type: "string", format: "short" } },
  });
  const model = resolveModel(schema, contract);
  expect(model.validateFormats({ rows: ["ok", "long"] })).toMatchObject([
    { path: "/rows/1", code: "INVALID_FORMAT_VALUE" },
  ]);
  expect(
    modelIssues(document({ a: { type: "string", format: "short", default: "long" } }), contract),
  ).toMatchObject([{ code: "INVALID_DEFAULT" }]);
});

it("未使用的 $defs 也校验 format 与 default", () => {
  expect(
    modelIssues({
      ...document({}),
      $defs: { invalid: { type: "string", format: "select" } },
    }),
  ).toMatchObject([{ path: "/$defs/invalid/format", code: "INVALID_FORMAT" }]);
  expect(
    modelIssues({
      ...document({}),
      $defs: { invalid: { type: "integer", default: 1.5 } },
    }),
  ).toMatchObject([{ path: "/$defs/invalid/default", code: "INVALID_DEFAULT" }]);
});

it("稳定身份和表名编码不会把连字符及下划线折叠", () => {
  const a = compileDefinition({ ...document({}), id: "a-b" });
  const b = compileDefinition({ ...document({}), id: "a_b" });
  expect(a.backend.storage.table).not.toBe(b.backend.storage.table);
  const draft = assignFieldIds({
    id: "sample",
    data: { id: { type: "string", readOnly: true }, title: { type: "string" } },
  });
  expect(draft.data).toMatchObject({ id: { id: "id" } });
  expect(
    assignFieldIds({ id: "sample", data: { title: { type: "string" } } }, draft).data,
  ).toMatchObject({ title: { id: (draft.data as Record<string, { id: string }>).title.id } });
});

it("旧定义转换保留绑定和枚举，并显式报告布局及 scene props 冲突", () => {
  const legacy = {
    document: {
      id: "legacy",
      title: "旧模型",
      data: {
        type: "object",
        properties: {
          title: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string", enum: ["a", "b"] } },
        },
        required: ["title"],
      },
      fields: {
        "/title": {
          form: { props: { placeholder: "编辑" } },
          filter: { props: { placeholder: "筛选" } },
        },
      },
      views: { list: { component: "Object" } },
    },
    backend: {
      storage: {
        table: "legacy_rows",
        bindings: [
          {
            id: "title-id",
            path: "/title",
            column: "heading",
            sqlType: "TEXT",
            encoding: "scalar",
          },
        ],
      },
      relations: [],
    },
  };
  const result = migrateLegacyDefinition(legacy);
  expect(result.definition.data.title).toMatchObject({
    id: "title-id",
    type: "string",
    nullable: true,
    required: true,
    storage: { column: "heading" },
  });
  expect(result.definition.data.tags.enum).toEqual(["a", "b"]);
  expect(result.report.errors.map((issue) => issue.message).join(" ")).toContain("props 冲突");
  expect(result.report.errors.some((issue) => issue.path === "/document/views")).toBe(true);
  expect(legacy.document.views).toBeDefined();
  expect(
    migrateLegacyDefinition(legacy, { layoutsMigrated: true }).report.errors.some(
      (issue) => issue.path === "/document/views",
    ),
  ).toBe(false);
});
