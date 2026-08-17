import { describe, expect, it } from "vitest";
import type { CmsModelSchema } from "../types";
import { buildModelSchema } from "./build-model-schema";
import { normalizeSchema } from "./normalize-schema";
import { schemaToBuilderDraft } from "./schema-to-builder-draft";
import { isSystemField } from "./system-fields";

describe("normalizeSchema", () => {
  it("递归归一化 x-layout、对象和数组字段", () => {
    const normalized = normalizeSchema({
      type: "object",
      title: "文章",
      properties: {
        section: {
          "x-layout": "SectionCard",
          properties: {
            title: { type: "string" },
          },
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              quantity: { type: "number" },
            },
          },
        },
      },
      "x-model": { name: "article" },
    });

    expect(normalized.properties?.section).toMatchObject({
      component: "SectionCard",
      decorator: undefined,
      properties: {
        title: {
          component: "Input",
          decorator: "FormItem",
          title: "title",
        },
      },
    });
    expect(normalized.properties?.rows.items).toMatchObject({
      properties: {
        quantity: {
          component: "NumberInput",
          title: "quantity",
        },
      },
    });
    expect(normalized["x-model"]).toMatchObject({
      name: "article",
      title: "文章",
      defaultPageSize: 10,
    });
  });
});

describe("schemaToBuilderDraft", () => {
  it("将 x-layout 恢复为 layout 草稿并可无损重建布局语义", () => {
    const schema = {
      type: "object",
      properties: {
        section: {
          "x-layout": "GridLayout",
          title: "信息区",
          props: { columns: 2 },
          properties: {
            title: { type: "string", title: "标题", order: 10 },
          },
          order: 10,
        },
      },
      "x-model": {
        name: "article",
        title: "文章",
      },
    } satisfies CmsModelSchema;

    const draft = schemaToBuilderDraft(schema);

    expect(draft.fields[0]).toMatchObject({
      key: "section",
      type: "layout",
      component: "GridLayout",
      decorator: undefined,
      children: [
        {
          key: "title",
          type: "string",
        },
      ],
    });
    expect(buildModelSchema(draft).properties?.section).toMatchObject({
      "x-layout": "GridLayout",
      props: { columns: 2 },
    });
    expect(buildModelSchema(draft).properties?.section).not.toHaveProperty("type");
  });
});

describe("isSystemField", () => {
  it("只识别约定的系统字段 key", () => {
    expect(isSystemField("id")).toBe(true);
    expect(isSystemField("createdBy")).toBe(true);
    expect(isSystemField("title")).toBe(false);
  });
});
