import type { ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "./_sys_role.ts";
import { physicalField, recordPages, systemFields, virtualField } from "./system-model.ts";

export const SYS_USER_MODEL = "_sys_user";
export const SYS_ADMIN_ID = "MDM0000000000";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_USER_MODEL);

const fields: ModelFieldSchema[] = [
  idField,
  physicalField(
    SYS_USER_MODEL,
    "username",
    { type: "text", nullable: false, unique: true, index: true },
    {
      type: "string",
      title: "账号",
      component: "Input",
      required: true,
      props: { placeholder: "请输入登录账号" },
    },
    { table: { title: "账号" } },
  ),
  virtualField(SYS_USER_MODEL, "password", {
    type: "string",
    title: "密码",
    component: "Input",
    props: { type: "password", placeholder: "留空表示不修改密码" },
  }),
  physicalField(
    SYS_USER_MODEL,
    "passwordHash",
    { type: "text" },
    { type: "string", title: "密码摘要", display: "none" },
    { table: { title: "密码摘要", hidden: true }, filter: { hidden: true } },
  ),
  virtualField(SYS_USER_MODEL, "gender", {
    type: "string",
    title: "性别",
    component: "Select",
    dataSource: [
      { label: "男", value: "male" },
      { label: "女", value: "female" },
      { label: "其他", value: "other" },
    ],
  }),
  virtualField(SYS_USER_MODEL, "city", {
    type: "string",
    title: "城市",
    component: "Input",
    props: { placeholder: "请输入城市" },
  }),
  virtualField(SYS_USER_MODEL, "remark", {
    type: "string",
    title: "备注",
    component: "TextArea",
    props: { rows: 3 },
  }),
  physicalField(
    SYS_USER_MODEL,
    "roleId",
    { type: "json", valueType: "array", nullable: false, index: true },
    {
      type: "array",
      title: "角色",
      component: "RemoteSelect",
      required: true,
      props: {
        model: SYS_ROLE_MODEL,
        valueField: "id",
        labelField: "name",
        pageSize: 50,
        multiple: true,
        loadOptions: '{{ $utils.relation($service("records.list")) }}',
      },
    },
    {
      relation: {
        kind: "many-to-many",
        target: SYS_ROLE_MODEL,
        through: "_sys_user_roles",
        valueField: "id",
        labelField: "name",
      },
      table: { title: "角色" },
      filter: { hidden: true },
    },
  ),
  // Legacy physical columns remain hidden so existing installations can migrate without rebuilding.
  physicalField(
    SYS_USER_MODEL,
    "nickname",
    { type: "text", nullable: false, index: true },
    { type: "string", title: "昵称", display: "none", required: true },
    { table: { title: "昵称", hidden: true }, filter: { hidden: true } },
  ),
  physicalField(
    SYS_USER_MODEL,
    "createBy",
    { type: "text", default: SYS_ADMIN_ID, index: true },
    { type: "string", title: "创建者", display: "none", default: SYS_ADMIN_ID },
    { table: { title: "创建者", hidden: true }, filter: { hidden: true } },
  ),
  physicalField(
    SYS_USER_MODEL,
    "super",
    { type: "boolean", valueType: "boolean", default: false, index: true },
    { type: "boolean", title: "超级管理员", display: "none", default: false },
    { table: { title: "超级管理员", hidden: true }, filter: { hidden: true } },
  ),
  createdAtField,
  updatedAtField,
];

export const sysUserSchema: ModelSchema = {
  name: SYS_USER_MODEL,
  title: "用户管理",
  version: 0,
  system: true,
  systemRevision: 6,
  subtitle: "System Users",
  description: "系统登录账号、角色与基础资料管理。",
  group: "system",
  singularLabel: "用户",
  pluralLabel: "用户",
  defaultPageSize: 20,
  fields,
  pages: recordPages(SYS_USER_MODEL, "用户", [
    "username",
    "password",
    "gender",
    "city",
    "remark",
    "roleId",
  ]).map((page) =>
    page.router !== "list"
      ? page
      : {
          ...page,
          properties: {
            ...page.properties,
            table: {
              ...page.properties.table,
              props: page.properties.table.props,
              properties: {
                ...page.properties.table.properties,
                delete: {
                  ...page.properties.table.properties?.delete,
                  props: {
                    ...page.properties.table.properties?.delete?.props,
                    disabled: `{{ $row.id === "${SYS_ADMIN_ID}" }}`,
                  },
                },
              },
            },
          },
        },
  ),
};

export const SYS_ADMIN_ROLE_ID = SYS_ROLE_SUPER_ADMIN_ID;
