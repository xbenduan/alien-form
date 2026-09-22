import { describe, expect, it } from "vitest";
import type { ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { compileMigrationPlan, compileStorageManifest } from "./storage-compiler.ts";

function systemField(key: "id" | "createdAt" | "updatedAt"): ModelFieldSchema {
  return {
    id: `article.${key}`,
    key,
    type: "string",
    title: key,
    required: true,
    storage: {
      type: key === "id" ? "text" : "date",
      system: true,
      ...(key === "id" ? { unique: true, index: true } : {}),
    },
    form: {},
  };
}

function model(fields: ModelFieldSchema[], version = 1): ModelSchema {
  const allFields = [
    systemField("id"),
    ...fields,
    systemField("createdAt"),
    systemField("updatedAt"),
  ];
  return {
    name: "article",
    title: "文章",
    version,
    fields: allFields,
    form: {
      type: "object",
      properties: Object.fromEntries(
        allFields.map((field) => [field.key, { $ref: `#/fields/${field.key}` }]),
      ),
    },
    pages: [],
  };
}

describe("Storage Compiler", () => {
  it("只为 physical many-to-many 字段生成关系表", () => {
    const relation = {
      kind: "many-to-many" as const,
      target: "tag",
      valueField: "id",
      labelField: "name",
    };
    const schema = model([
      {
        id: "article.tags",
        key: "tags",
        type: "array",
        storage: { type: "json" },
        relation,
        form: { component: "RemoteSelect" },
      },
      {
        id: "article.related",
        key: "related",
        type: "array",
        relation,
        form: { component: "RemoteSelect" },
      },
    ]);

    expect(compileStorageManifest(schema).relations).toEqual([
      expect.objectContaining({ field: "tags", table: "article_tags" }),
    ]);
  });

  it("更新模型只生成追加列和索引操作", () => {
    const current = model([]);
    const incoming = model(
      [
        {
          id: "article.status",
          key: "status",
          type: "string",
          title: "状态",
          required: true,
          storage: { type: "text", default: "draft", index: true },
          form: {},
        },
      ],
      2,
    );

    const { plan } = compileMigrationPlan(current, incoming);
    expect(plan.operations.map((operation) => operation.kind)).toEqual(["add-column", "add-index"]);
  });

  it("将单值关联原子迁移到多对多关系表并保留旧列", () => {
    const relation = {
      target: "role",
      valueField: "id",
      labelField: "name",
    };
    const current = model([
      {
        id: "article.roles",
        key: "roles",
        type: "string",
        required: true,
        storage: { type: "text", index: true },
        relation: { kind: "many-to-one", ...relation },
        form: { component: "RemoteSelect" },
      },
    ]);
    const incoming = model(
      [
        {
          id: "article.roles",
          key: "roles",
          type: "array",
          required: true,
          storage: { type: "json", index: true },
          relation: { kind: "many-to-many", through: "article_roles", ...relation },
          form: { component: "RemoteSelect" },
        },
      ],
      2,
    );

    const { manifest, plan } = compileMigrationPlan(current, incoming);

    expect(manifest.columns.some((column) => column.field === "roles")).toBe(false);
    expect(plan.operations.map((operation) => operation.kind)).toEqual([
      "add-relation-table",
      "migrate-relation-values",
    ]);
    expect(plan.operations[1]?.sql).toContain(
      'SELECT "id", "roles" FROM "article" WHERE "roles" IS NOT NULL',
    );
  });
});
