import type { AlienSchema } from "@alien-form/protocol";
import {
  modelForm,
  physicalField,
  recordPages,
  systemFields,
  virtualField,
} from "./system-model.ts";

export const SYS_MODEL_CATEGORY_MODEL = "_sys_model_category";
export const SYS_MODEL_CATEGORY_ALL_ID = "SYSCATEGORY000001";
export const SYS_MODEL_CATEGORY_SYSTEM_ID = "SYSCATEGORY000002";
export const SYS_MODEL_CATEGORY_OTHER_ID = "SYSCATEGORY000003";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_MODEL_CATEGORY_MODEL);

const fields: AlienSchema["fields"] = [
  idField,
  physicalField(SYS_MODEL_CATEGORY_MODEL, "code", {
    type: "string",
    title: "分类标识",
    required: true,
    storage: { type: "text", unique: true, index: true },
    form: { component: "Input", props: { placeholder: "请输入分类标识" } },
  }),
  physicalField(SYS_MODEL_CATEGORY_MODEL, "name", {
    type: "string",
    title: "分类名称",
    required: true,
    storage: { type: "text", index: true },
    form: { component: "Input", props: { placeholder: "请输入分类名称" } },
  }),
  physicalField(SYS_MODEL_CATEGORY_MODEL, "order", {
    type: "number",
    title: "排序",
    required: true,
    storage: { type: "integer", default: 0, index: true },
    form: { component: "NumberInput", default: 0, props: { min: 0 } },
  }),
  physicalField(SYS_MODEL_CATEGORY_MODEL, "aggregate", {
    type: "boolean",
    title: "聚合分类",
    required: true,
    storage: { type: "boolean", default: false },
    form: {
      component: "Select",
      default: false,
      dataSource: [
        { label: "是", value: true },
        { label: "否", value: false },
      ],
    },
  }),
  virtualField(SYS_MODEL_CATEGORY_MODEL, "description", {
    type: "string",
    title: "描述",
    form: { component: "TextArea", props: { rows: 3 } },
  }),
  createdAtField,
  updatedAtField,
];

export const sysModelCategorySchema: AlienSchema = {
  name: SYS_MODEL_CATEGORY_MODEL,
  title: "分类标签",
  version: 0,
  system: true,
  systemRevision: 5,
  subtitle: "Model Categories",
  description: "模型分类标签与模型归属配置。",
  group: "system",
  singularLabel: "分类标签",
  pluralLabel: "分类标签",
  defaultPageSize: 20,
  fields,
  form: modelForm(fields, ["code", "name", "order", "aggregate", "description"]),
  pages: recordPages(SYS_MODEL_CATEGORY_MODEL, "分类标签", [
    "code",
    "name",
    "order",
    "aggregate",
    "description",
  ]),
};
