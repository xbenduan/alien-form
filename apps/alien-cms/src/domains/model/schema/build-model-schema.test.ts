import { describe, expect, it } from "vitest";
import type { ModelBuilderDraft, ModelBuilderFieldDraft } from "../types";
import { buildModelSchema } from "./build-model-schema";

function createField(
  overrides: Partial<ModelBuilderFieldDraft> & Pick<ModelBuilderFieldDraft, "key" | "title">,
): ModelBuilderFieldDraft {
  return {
    id: `field-${overrides.key}`,
    type: "string",
    component: "Input",
    decorator: "FormItem",
    required: false,
    defaultValueText: "",
    propsText: "{}",
    dataSourceText: "",
    tableWidthText: "",
    tableEllipsis: true,
    tableInlineFields: [],
    reactions: [],
    ...overrides,
  };
}

function createDraft(fields: ModelBuilderFieldDraft[]): ModelBuilderDraft {
  return {
    modelName: "article",
    title: "文章",
    subtitle: "",
    description: "",
    singularLabel: "记录",
    pluralLabel: "记录",
    defaultPageSize: 10,
    filterCount: 3,
    tableDefaultWidth: undefined,
    tableVisibleFields: [],
    openMode: { add: "drawer", edit: "drawer", detail: "drawer" },
    fields,
  };
}

describe("buildModelSchema", () => {
  it("为系统字段注入后端只读语义", () => {
    const schema = buildModelSchema(
      createDraft([
        createField({ key: "id", title: "ID" }),
        createField({
          key: "createdAt",
          title: "创建时间",
          type: "number",
          component: "NumberInput",
        }),
        createField({
          key: "updatedAt",
          title: "更新时间",
          type: "number",
          component: "NumberInput",
        }),
      ]),
    );

    expect(schema.properties?.id).toMatchObject({
      type: "string",
      component: "Input",
      decorator: "FormItem",
      display: "none",
    });
    for (const key of ["createdAt", "updatedAt"]) {
      expect(schema.properties?.[key]).toMatchObject({
        type: "number",
        component: "NumberInput",
        decorator: "FormItem",
        display: "none",
        "x-cms": {
          table: { format: "dateTime" },
          form: { modes: [] },
          detail: { format: "dateTime" },
        },
      });
    }
  });

  it("将布局草稿输出为 x-layout 节点而不是字段类型", () => {
    const schema = buildModelSchema(
      createDraft([
        createField({
          key: "section",
          title: "基础信息",
          type: "layout",
          component: "SectionCard",
          decorator: undefined,
          children: [createField({ key: "title", title: "标题" })],
        }),
      ]),
    );

    expect(schema.properties?.section).toMatchObject({
      "x-layout": "SectionCard",
      properties: {
        title: {
          type: "string",
          title: "标题",
        },
      },
    });
    expect(schema.properties?.section).not.toHaveProperty("type");
    expect(schema.properties?.section).not.toHaveProperty("component");
  });

  it("在 Builder JSON 配置无效时给出字段定位错误", () => {
    expect(() =>
      buildModelSchema(createDraft([createField({ key: "title", title: "标题", propsText: "{" })])),
    ).toThrow("标题 props is not valid JSON");
  });
});
