import type { IFormSchema } from "@alien-form/core";

export const defaultFields = {
  name: {
    type: "string",
    title: "名称",
    component: "Input",
    required: true,
    "x-database": { column: "name", length: 128 },
    "x-table": { filterable: true },
  },
  status: {
    type: "string",
    title: "状态",
    component: "Select",
    dataSource: [
      { label: "启用", value: "active" },
      { label: "停用", value: "inactive" },
    ],
    "x-database": { column: "status", length: 32 },
  },
};

export const modelEditSchema: IFormSchema = {
  type: "object",
  properties: {
    modelCode: {
      type: "string",
      title: "模型编码",
      component: "Input",
      required: true,
      props: { placeholder: "例如 product_category" },
    },
    title: {
      type: "string",
      title: "模型名称",
      component: "Input",
      required: true,
    },
    description: {
      type: "string",
      title: "说明",
      component: "TextArea",
      props: { rows: 3 },
    },
    fieldsJson: {
      type: "string",
      title: "字段定义",
      component: "TextArea",
      required: true,
      props: {
        rows: 18,
        spellCheck: false,
        style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
  },
};
