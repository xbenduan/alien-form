import type { AlienSchema } from "@alien-form/protocol";
import {
  modelForm,
  physicalField,
  recordPages,
  systemFields,
  virtualField,
} from "./system-model.ts";

export const SYS_MODEL_TAB_MODEL = "_sys_model_tab";
export const SYS_MODEL_TAB_ALL_ID = "SYSTAB000001";
export const SYS_MODEL_TAB_SYSTEM_ID = "SYSTAB000002";
export const SYS_MODEL_TAB_OTHER_ID = "SYSTAB000003";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_MODEL_TAB_MODEL);

const fields: AlienSchema["fields"] = [
  idField,
  physicalField(SYS_MODEL_TAB_MODEL, "code", {
    type: "string",
    title: "标识",
    required: true,
    storage: { type: "text", unique: true, index: true },
    form: { component: "Input", props: { placeholder: "请输入标识" } },
  }),
  physicalField(SYS_MODEL_TAB_MODEL, "name", {
    type: "string",
    title: "名称",
    required: true,
    storage: { type: "text", index: true },
    form: { component: "Input", props: { placeholder: "请输入名称" } },
  }),
  physicalField(SYS_MODEL_TAB_MODEL, "order", {
    type: "number",
    title: "排序",
    required: true,
    storage: { type: "integer", default: 0, index: true },
    form: { component: "NumberInput", default: 0, props: { min: 0 } },
  }),
  physicalField(SYS_MODEL_TAB_MODEL, "aggregate", {
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
  virtualField(SYS_MODEL_TAB_MODEL, "description", {
    type: "string",
    title: "描述",
    form: { component: "TextArea", props: { rows: 3 } },
  }),
  createdAtField,
  updatedAtField,
];

export const sysModelTabSchema: AlienSchema = {
  name: SYS_MODEL_TAB_MODEL,
  title: "模型分类",
  version: 0,
  system: true,
  systemRevision: 4,
  subtitle: "Model Navigation Tabs",
  description: "模型首页分类与模型归属配置。",
  group: "system",
  singularLabel: "Tab",
  pluralLabel: "Tabs",
  defaultPageSize: 20,
  fields,
  form: modelForm(fields, ["code", "name", "order", "aggregate", "description"]),
  pages: recordPages(SYS_MODEL_TAB_MODEL, "模型分类", [
    "code",
    "name",
    "order",
    "aggregate",
    "description",
  ]),
};
