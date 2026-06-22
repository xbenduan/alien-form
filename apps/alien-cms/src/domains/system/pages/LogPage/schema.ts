import type {
  CmsFieldSchema,
  CmsModelSchema,
  TableColumnProjection,
} from "../../../record/types/record";

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "schema.create": { label: "创建模型", color: "blue" },
  "schema.update": { label: "更新模型", color: "cyan" },
  "schema.delete": { label: "删除模型", color: "red" },
  "record.create": { label: "创建记录", color: "green" },
  "record.update": { label: "更新记录", color: "orange" },
  "record.delete": { label: "删除记录", color: "volcano" },
  "record.batchDelete": { label: "批量删除", color: "magenta" },
};

export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, { label }]) => ({
  value,
  label,
}));

export const filterSchema: CmsModelSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      title: "操作类型",
      decorator: "FilterItem",
      component: "Select",
      dataSource: ACTION_OPTIONS,
      props: {
        placeholder: "请选择操作类型",
      },
    },
    modelName: {
      type: "string",
      title: "模型名称",
      decorator: "FilterItem",
      component: "Input",
      props: {
        placeholder: "请输入模型名称",
      },
    },
    dateStart: {
      type: "string",
      title: "开始时间",
      decorator: "FilterItem",
      component: "DateInput",
      props: {
        placeholder: "选择开始日期",
      },
    },
    dateEnd: {
      type: "string",
      title: "结束时间",
      decorator: "FilterItem",
      component: "DateInput",
      props: {
        placeholder: "选择结束日期",
      },
    },
  },
};

export const filterDefaultVisibleKeys = ["action", "modelName", "dateStart", "dateEnd"];

const stringField = (title: string): CmsFieldSchema => ({ type: "string", title });

export const tableColumns: TableColumnProjection[] = [
  {
    key: "timestamp",
    title: "时间",
    width: 180,
    ellipsis: false,
    order: 0,
    format: "dateTime",
    type: "string",
    field: stringField("时间"),
  },
  {
    key: "action",
    title: "操作类型",
    width: 120,
    ellipsis: false,
    order: 1,
    format: "status",
    dataSource: ACTION_OPTIONS,
    type: "string",
    field: stringField("操作类型"),
  },
  {
    key: "modelName",
    title: "模型",
    width: 140,
    ellipsis: true,
    order: 2,
    type: "string",
    field: stringField("模型"),
  },
  {
    key: "recordId",
    title: "记录 ID",
    width: 200,
    ellipsis: true,
    order: 3,
    type: "string",
    field: stringField("记录 ID"),
  },
  {
    key: "summary",
    title: "摘要",
    ellipsis: true,
    order: 4,
    type: "string",
    field: stringField("摘要"),
  },
];
