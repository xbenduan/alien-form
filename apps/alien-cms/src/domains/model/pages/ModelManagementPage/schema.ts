import type {
  CmsFieldSchema,
  CmsModelSchema,
  TableColumnProjection,
} from "../../../record/types/record";

export const SOURCE_OPTIONS = [
  { label: "静态", value: "static" },
  { label: "运行时", value: "runtime" },
  { label: "远程", value: "remote" },
];

export const filterSchema: CmsModelSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "模型名",
      decorator: "FilterItem",
      component: "Input",
      props: {
        placeholder: "按模型名搜索",
      },
    },
    title: {
      type: "string",
      title: "标题",
      decorator: "FilterItem",
      component: "Input",
      props: {
        placeholder: "按标题搜索",
      },
    },
    description: {
      type: "string",
      title: "描述",
      decorator: "FilterItem",
      component: "Input",
      props: {
        placeholder: "按描述搜索",
      },
    },
  },
};

export const filterDefaultVisibleKeys = ["name", "title", "description"];

const stringField = (title: string): CmsFieldSchema => ({ type: "string", title });

export const tableColumns: TableColumnProjection[] = [
  {
    key: "name",
    title: "模型名",
    width: 180,
    ellipsis: true,
    order: 0,
    type: "string",
    field: stringField("模型名"),
  },
  {
    key: "title",
    title: "标题",
    width: 180,
    ellipsis: true,
    order: 1,
    type: "string",
    field: stringField("标题"),
  },
  {
    key: "source",
    title: "来源",
    width: 120,
    ellipsis: false,
    order: 2,
    format: "status",
    dataSource: SOURCE_OPTIONS,
    type: "string",
    field: stringField("来源"),
  },
  {
    key: "fieldCount",
    title: "字段数",
    width: 100,
    ellipsis: false,
    order: 3,
    type: "number",
    field: { type: "number", title: "字段数" },
  },
  {
    key: "description",
    title: "描述",
    ellipsis: true,
    order: 4,
    type: "string",
    field: stringField("描述"),
  },
];
