import type { ModelFieldSchema, ModelSchema } from "../schema/types.ts";

export const SYS_ADMIN_ID = "_sys_admin";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_NICKNAME = "系统管理员";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

const fields: Record<string, ModelFieldSchema> = {
  username: {
    type: "string",
    title: "账号",
    component: "Input",
    required: true,
    props: { placeholder: "请输入登录账号" },
    "x-table": { width: 160 },
    "x-database": { type: "text", unique: true, index: true, filterable: true },
  },
  passwordHash: {
    type: "string",
    title: "密码",
    component: "Input",
    display: "none",
    "x-table": { visible: false },
    "x-database": { type: "text" },
  },
  nickname: {
    type: "string",
    title: "昵称",
    component: "Input",
    required: true,
    props: { placeholder: "请输入昵称" },
    "x-table": { width: 160 },
    "x-database": { type: "text", index: true, filterable: true },
  },
  remark: {
    type: "string",
    title: "备注",
    component: "TextArea",
    props: { rows: 3 },
    "x-table": { visible: false },
    "x-database": { type: "text" },
  },
  createBy: {
    type: "string",
    title: "创建者",
    component: "Input",
    display: "hidden",
    default: SYS_ADMIN_ID,
    "x-table": { visible: true, width: 160 },
    "x-database": { type: "text", default: SYS_ADMIN_ID, filterable: true },
  },
  id: {
    type: "string",
    title: "ID",
    display: "hidden",
    "x-table": { visible: true, width: 180 },
    "x-database": { type: "text", filterable: true },
  },
  createdAt: {
    type: "string",
    title: "创建时间",
    display: "hidden",
    "x-table": { visible: true, width: 180 },
    "x-database": { type: "text", filterable: true },
  },
  updatedAt: {
    type: "string",
    title: "更新时间",
    display: "hidden",
    "x-table": { visible: true, width: 180 },
    "x-database": { type: "text", filterable: true },
  },
};

export const sysUserSchema: ModelSchema = {
  meta: {
    name: "_sys_user",
    title: "用户管理",
    subtitle: "System Users",
    description: "系统登录账号管理。",
    group: "system",
    singularLabel: "用户",
    pluralLabel: "用户",
    filterCount: 4,
    defaultPageSize: 20,
    openMode: {
      add: "drawer",
      edit: "modal",
      detail: "page",
    },
  },
  "x-pages": [
    {
      router: "list",
      title: "用户管理",
      layout: {
        component: "layout",
        props: { rightTop: "filter", rightBottom: "table" },
      },
      schema: {
        properties: {
          filter: {
            type: "string",
            component: "filter",
            props: { schema: { $ref: "form-schema" } },
          },
          table: {
            type: "void",
            component: "table",
            props: {
              rowKey: "id",
              modelCode: "_sys_user",
              schema: { $ref: "form-schema" },
              columns: "{{ $utils.schemaToColumns }}",
              filter: "{{ $values.filter }}",
              loadData:
                "{{ (params) => $service.records.list({ model: '_sys_user', ...params }) }}",
            },
          },
        },
      },
    },
    ...(["add", "edit", "detail"] as const).map((mode) => ({
      router: mode,
      title: `${mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情"}用户`,
      schema: {
        properties: {
          form: {
            type: "void",
            component: "record-form",
            props: {
              mode,
              modelCode: "_sys_user",
              recordId: mode === "add" ? undefined : "{{ $query.id }}",
              schema: { $ref: "form-schema" },
            },
          },
        },
      },
    })),
  ],
  definitions: {
    "form-schema": {
      type: "object",
      properties: fields,
      group: [
        {
          component: "ObjectField",
          title: "基础信息",
          keys: ["username", "nickname", "remark"],
        },
      ],
    },
  },
};
