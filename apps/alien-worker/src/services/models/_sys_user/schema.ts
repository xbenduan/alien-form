import { createRecordPages, type AlienSchema } from "@alien-form/protocol";
import {
  modelForm,
  physicalField,
  systemFields,
  virtualField,
} from "../../../utils/system-model.ts";

/** Builds the user protocol from constants owned by model entries. */
export default function createSchema(
  constants: { readonly code: string; readonly adminId: string },
  roleModelCode: string,
): AlienSchema {
  const modelCode = constants.code;
  const [idField, createdAtField, updatedAtField] = systemFields(modelCode);

  const fields: AlienSchema["fields"] = [
    idField,
    physicalField(modelCode, "username", {
      type: "string",
      title: "账号",
      required: true,
      storage: { type: "text", unique: true, index: true },
      form: { component: "Input", props: { placeholder: "请输入登录账号" } },
    }),
    virtualField(modelCode, "password", {
      type: "string",
      title: "密码",
      form: {
        component: "Input",
        props: { type: "password", placeholder: "留空表示不修改密码" },
      },
    }),
    physicalField(modelCode, "passwordHash", {
      type: "string",
      title: "密码摘要",
      private: true,
      storage: { type: "text" },
      form: { display: "none" },
      table: { hidden: true },
      filter: { hidden: true },
    }),
    virtualField(modelCode, "gender", {
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
    virtualField(modelCode, "city", {
      type: "string",
      title: "城市",
      form: { component: "Input", props: { placeholder: "请输入城市" } },
    }),
    virtualField(modelCode, "remark", {
      type: "string",
      title: "备注",
      form: { component: "TextArea", props: { rows: 3 } },
    }),
    physicalField(modelCode, "roleId", {
      type: "array",
      title: "角色",
      required: true,
      storage: { type: "json", index: true },
      relation: {
        kind: "many-to-many",
        target: roleModelCode,
        through: "_sys_user_roles",
        valueField: "id",
        labelField: "name",
      },
      form: { component: "RemoteSelect" },
      filter: { hidden: true },
    }),
    // Legacy physical columns remain hidden so existing installations can migrate without rebuilding.
    physicalField(modelCode, "nickname", {
      type: "string",
      title: "昵称",
      required: true,
      storage: { type: "text", index: true },
      form: { display: "none" },
      table: { hidden: true },
      filter: { hidden: true },
    }),
    physicalField(modelCode, "createBy", {
      type: "string",
      title: "创建者",
      storage: { type: "text", default: constants.adminId, index: true },
      form: { display: "none", default: constants.adminId },
      table: { hidden: true },
      filter: { hidden: true },
    }),
    physicalField(modelCode, "super", {
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

  return {
    name: modelCode,
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
    pages: createRecordPages(modelCode, "用户", [
      "username",
      "password",
      "gender",
      "city",
      "remark",
      "roleId",
    ]).map((page) => (page.router !== "list" ? page : disableAdminDelete(page, constants.adminId))),
  };
}

function disableAdminDelete(
  page: AlienSchema["pages"][number],
  adminId: string,
): AlienSchema["pages"][number] {
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
                  disabled: `{{ $row.id === "${adminId}" }}`,
                },
              },
            },
          },
        },
      },
    },
  };
}
