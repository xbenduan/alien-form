import { describe, expect, it } from "vitest";
import { buildModelSchema } from "./build-model-schema";
import type { ModelBuilderDraft } from "../types/builder";

function createDraft(): ModelBuilderDraft {
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
    fields: [
      {
        id: "field-title",
        key: "title",
        title: "标题",
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
      },
      {
        id: "field-id",
        key: "id",
        title: "ID",
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
      },
      {
        id: "field-created-at",
        key: "createdAt",
        title: "创建时间",
        type: "number",
        component: "NumberInput",
        decorator: "FormItem",
        required: false,
        defaultValueText: "",
        propsText: "{}",
        dataSourceText: "",
        tableWidthText: "",
        tableEllipsis: true,
        tableInlineFields: [],
        reactions: [],
      },
      {
        id: "field-updated-at",
        key: "updatedAt",
        title: "更新时间",
        type: "number",
        component: "NumberInput",
        decorator: "FormItem",
        required: false,
        defaultValueText: "",
        propsText: "{}",
        dataSourceText: "",
        tableWidthText: "",
        tableEllipsis: true,
        tableInlineFields: [],
        reactions: [],
      },
    ],
  };
}

describe("buildModelSchema", () => {
  it("为系统字段注入后端只读语义", () => {
    const schema = buildModelSchema(createDraft());

    expect(schema.properties?.id).toMatchObject({
      type: "string",
      component: "Input",
      decorator: "FormItem",
      display: "none",
    });
    expect(schema.properties?.createdAt).toMatchObject({
      type: "number",
      component: "NumberInput",
      decorator: "FormItem",
      "x-cms": {
        table: {
          format: "dateTime",
        },
        form: {
          modes: [],
        },
        detail: {
          format: "dateTime",
        },
      },
    });
    expect(schema.properties?.updatedAt).toMatchObject({
      type: "number",
      component: "NumberInput",
      decorator: "FormItem",
      "x-cms": {
        table: {
          format: "dateTime",
        },
        form: {
          modes: [],
        },
        detail: {
          format: "dateTime",
        },
      },
    });
  });
});
