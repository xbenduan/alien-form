import { describe, expect, it } from "vitest";
import type { ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { compileMigrationPlan, compileStorageManifest } from "./storage-compiler.ts";

function systemField(key: "id" | "createdAt" | "updatedAt"): ModelFieldSchema {
  return {
    id: `article.${key}`,
    key,
    storage: "physical",
    database: {
      type: key === "id" ? "text" : "date",
      system: true,
      nullable: false,
      ...(key === "id" ? { unique: true, index: true } : {}),
    },
    form: { type: "string", title: key },
  };
}

function model(fields: ModelFieldSchema[], version = 1): ModelSchema {
  return {
    name: "article",
    title: "文章",
    version,
    fields: [systemField("id"), ...fields, systemField("createdAt"), systemField("updatedAt")],
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
        storage: "physical",
        database: { type: "json", valueType: "array" },
        relation,
        form: {
          type: "array",
          component: "RemoteSelect",
          props: { model: "tag", valueField: "id", labelField: "name" },
        },
      },
      {
        id: "article.related",
        key: "related",
        storage: "virtual",
        relation,
        form: {
          type: "array",
          component: "RemoteSelect",
          props: { model: "tag", valueField: "id", labelField: "name" },
        },
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
          storage: "physical",
          database: {
            type: "text",
            nullable: false,
            default: "draft",
            index: true,
          },
          form: { type: "string", title: "状态", required: true },
        },
      ],
      2,
    );

    const { plan } = compileMigrationPlan(current, incoming);
    expect(plan.operations.map((operation) => operation.kind)).toEqual(["add-column", "add-index"]);
  });
});
