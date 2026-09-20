import type { ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { physicalField, recordPages, systemFields, virtualField } from "./system-model.ts";

export const SYS_MODEL_TAB_MODEL = "_sys_model_tab";
export const SYS_MODEL_TAB_ALL_ID = "SYSTAB000001";
export const SYS_MODEL_TAB_SYSTEM_ID = "SYSTAB000002";
export const SYS_MODEL_TAB_OTHER_ID = "SYSTAB000003";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_MODEL_TAB_MODEL);

const fields: ModelFieldSchema[] = [
  idField,
  physicalField(
    SYS_MODEL_TAB_MODEL,
    "code",
    { type: "text", nullable: false, unique: true, index: true },
    {
      type: "string",
      title: "标识",
      component: "Input",
      required: true,
      props: { placeholder: "请输入 Tab 标识" },
    },
    { table: { title: "标识" } },
  ),
  physicalField(
    SYS_MODEL_TAB_MODEL,
    "name",
    { type: "text", nullable: false, index: true },
    {
      type: "string",
      title: "名称",
      component: "Input",
      required: true,
      props: { placeholder: "请输入 Tab 名称" },
    },
    { table: { title: "名称" } },
  ),
  physicalField(
    SYS_MODEL_TAB_MODEL,
    "order",
    { type: "integer", valueType: "number", nullable: false, default: 0, index: true },
    {
      type: "number",
      title: "排序",
      component: "NumberInput",
      required: true,
      default: 0,
      props: { min: 0 },
    },
    { table: { title: "排序" } },
  ),
  physicalField(
    SYS_MODEL_TAB_MODEL,
    "aggregate",
    { type: "boolean", valueType: "boolean", nullable: false, default: false },
    {
      type: "boolean",
      title: "聚合 Tab",
      component: "Select",
      required: true,
      default: false,
      dataSource: [
        { label: "是", value: true },
        { label: "否", value: false },
      ],
    },
    { table: { title: "聚合 Tab" } },
  ),
  virtualField(SYS_MODEL_TAB_MODEL, "description", {
    type: "string",
    title: "描述",
    component: "TextArea",
    props: { rows: 3 },
  }),
  createdAtField,
  updatedAtField,
];

export const sysModelTabSchema: ModelSchema = {
  name: SYS_MODEL_TAB_MODEL,
  title: "模型 Tabs",
  version: 0,
  system: true,
  systemRevision: 1,
  subtitle: "Model Navigation Tabs",
  description: "模型首页分类与模型归属配置。",
  group: "system",
  singularLabel: "Tab",
  pluralLabel: "Tabs",
  defaultPageSize: 20,
  fields,
  pages: recordPages(SYS_MODEL_TAB_MODEL, "模型 Tab", [
    "code",
    "name",
    "order",
    "aggregate",
    "description",
  ]),
};
