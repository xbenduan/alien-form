import type { ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "./_sys_role.ts";
import {
  modelForm,
  physicalField,
  recordPages,
  systemFields,
  virtualField,
} from "./system-model.ts";

export const SYS_USER_MODEL = "_sys_user";
export const SYS_ADMIN_ID = "MDM0000000000";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_USER_MODEL);

const fields: ModelFieldSchema[] = [
  idField,
  physicalField(SYS_USER_MODEL, "username", {
    type: "string",
    title: "账号",
    required: true,
    storage: { type: "text", unique: true, index: true },
    form: { component: "Input", props: { placeholder: "请输入登录账号" } },
  }),
  virtualField(SYS_USER_MODEL, "password", {
    type: "string",
    title: "密码",
    form: {
      component: "Input",
      props: { type: "password", placeholder: "留空表示不修改密码" },
    },
  }),
  physicalField(SYS_USER_MODEL, "passwordHash", {
    type: "string",
    title: "密码摘要",
    storage: { type: "text" },
    form: { display: "none" },
    table: { hidden: true },
    filter: { hidden: true },
  }),
  virtualField(SYS_USER_MODEL, "gender", {
    type: "string",
    title: "性别",
    form: {
      component: "Select",
      dataSource: [
        { label: "男", value: "male" },
        { label: "女", value: "female" },
        { label: "其他", value: "other" },
      ],
    },
  }),
  virtualField(SYS_USER_MODEL, "city", {
    type: "string",
    title: "城市",
    form: { component: "Input", props: { placeholder: "请输入城市" } },
  }),
  virtualField(SYS_USER_MODEL, "remark", {
    type: "string",
    title: "备注",
    form: { component: "TextArea", props: { rows: 3 } },
  }),
  physicalField(SYS_USER_MODEL, "roleId", {
    type: "array",
    title: "角色",
    required: true,
    storage: { type: "json", index: true },
    relation: {
      kind: "many-to-many",
      target: SYS_ROLE_MODEL,
      through: "_sys_user_roles",
      valueField: "id",
      labelField: "name",
    },
    form: { component: "RemoteSelect" },
    filter: { hidden: true },
  }),
  // Legacy physical columns remain hidden so existing installations can migrate without rebuilding.
  physicalField(SYS_USER_MODEL, "nickname", {
    type: "string",
    title: "昵称",
    required: true,
    storage: { type: "text", index: true },
    form: { display: "none" },
    table: { hidden: true },
    filter: { hidden: true },
  }),
  physicalField(SYS_USER_MODEL, "createBy", {
    type: "string",
    title: "创建者",
    storage: { type: "text", default: SYS_ADMIN_ID, index: true },
    form: { display: "none", default: SYS_ADMIN_ID },
    table: { hidden: true },
    filter: { hidden: true },
  }),
  physicalField(SYS_USER_MODEL, "super", {
    type: "boolean",
    title: "超级管理员",
    storage: { type: "boolean", default: false, index: true },
    form: { display: "none", default: false },
    table: { hidden: true },
    filter: { hidden: true },
  }),
  createdAtField,
  updatedAtField,
];

export const sysUserSchema: ModelSchema = {
  name: SYS_USER_MODEL,
  title: "用户管理",
  version: 0,
  system: true,
  systemRevision: 7,
  subtitle: "System Users",
  description: "系统登录账号、角色与基础资料管理。",
  group: "system",
  singularLabel: "用户",
  pluralLabel: "用户",
  defaultPageSize: 20,
  fields,
  form: modelForm(fields, ["username", "password", "gender", "city", "remark", "roleId"]),
  pages: recordPages(SYS_USER_MODEL, "用户", [
    "username",
    "password",
    "gender",
    "city",
    "remark",
    "roleId",
  ]).map((page) => (page.router !== "list" ? page : disableAdminDelete(page))),
};

function disableAdminDelete(page: ModelSchema["pages"][number]): ModelSchema["pages"][number] {
  const content = page.slots?.content;
  const table = content?.table;
  const rowActions = table?.slots?.rowActions;
  const deleteAction = rowActions?.delete;
  if (!content || !table || !rowActions || !deleteAction) return page;
  return {
    ...page,
    slots: {
      ...page.slots,
      content: {
        ...content,
        table: {
          ...table,
          slots: {
            ...table.slots,
            rowActions: {
              ...rowActions,
              delete: {
                ...deleteAction,
                props: {
                  ...deleteAction.props,
                  disabled: `{{ $row.id === "${SYS_ADMIN_ID}" }}`,
                },
              },
            },
          },
        },
      },
    },
  };
}

export const SYS_ADMIN_ROLE_ID = SYS_ROLE_SUPER_ADMIN_ID;
