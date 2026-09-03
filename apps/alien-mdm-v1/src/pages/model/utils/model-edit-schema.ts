import type { IFormSchema } from "@alien-form/core";
import type { DatabaseSchema, FieldGroup } from "@engine";

const OPEN_MODE_OPTIONS = [
  { label: "整页", value: "page" },
  { label: "抽屉", value: "drawer" },
  { label: "弹窗", value: "modal" },
];

export const defaultDatabase: DatabaseSchema = {
  fields: {
    name: {
      title: "名称",
      type: "text",
      nullable: false,
      unique: true,
      index: true,
      filterable: true,
    },
    status: {
      title: "状态",
      type: "text",
      nullable: false,
      index: true,
      filterable: true,
    },
  },
};

export const defaultFields = {
  name: {
    type: "string",
    title: "名称",
    component: "Input",
    required: true,
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
    required: true,
    "x-table": { filterable: true },
  },
};

export const defaultGroups: FieldGroup[] = [
  {
    component: "ObjectField",
    title: "基础信息",
    keys: ["name", "status"],
  },
];

export const modelEditSchema: IFormSchema = {
  type: "object",
  properties: {
    modelCode: {
      type: "string",
      title: "模型名",
      description: "只能使用字母、数字、下划线和中划线。",
      component: "Input",
      required: true,
    },
    title: {
      type: "string",
      title: "标题",
      component: "Input",
      required: true,
    },
    subtitle: {
      type: "string",
      title: "副标题",
      component: "Input",
    },
    group: {
      type: "string",
      title: "类型",
      component: "Select",
      dataSource: [
        { label: "系统", value: "system" },
        { label: "其他", value: "other" },
      ],
    },
    singularLabel: {
      type: "string",
      title: "单数标签",
      component: "Input",
    },
    pluralLabel: {
      type: "string",
      title: "复数标签",
      component: "Input",
    },
    filterCount: {
      type: "number",
      title: "默认筛选项数",
      component: "NumberInput",
      props: { min: 1 },
    },
    defaultPageSize: {
      type: "number",
      title: "每页数",
      component: "NumberInput",
      props: { min: 1 },
    },
    addOpenMode: {
      type: "string",
      title: "新增打开方式",
      component: "Select",
      dataSource: OPEN_MODE_OPTIONS,
    },
    editOpenMode: {
      type: "string",
      title: "编辑打开方式",
      component: "Select",
      dataSource: OPEN_MODE_OPTIONS,
    },
    detailOpenMode: {
      type: "string",
      title: "详情打开方式",
      component: "Select",
      dataSource: OPEN_MODE_OPTIONS,
    },
    description: {
      type: "string",
      title: "描述",
      component: "TextArea",
      props: { rows: 3 },
    },
    databaseJson: {
      type: "string",
      title: "数据库字段",
      description: "字段名和存储结构在此确定；后续表单配置只能调整展示与交互。",
      component: "TextArea",
      required: true,
      props: {
        rows: 24,
        spellCheck: false,
        style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
    fieldsJson: {
      type: "string",
      title: "字段定义",
      component: "TextArea",
      required: true,
      props: {
        rows: 20,
        spellCheck: false,
        style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
    groupsJson: {
      type: "string",
      title: "分组定义",
      component: "TextArea",
      required: true,
      props: {
        rows: 20,
        spellCheck: false,
        style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
    pagesJson: {
      type: "string",
      title: "页面定义（x-pages）",
      component: "TextArea",
      required: true,
      props: {
        rows: 22,
        spellCheck: false,
        style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
  },
};
