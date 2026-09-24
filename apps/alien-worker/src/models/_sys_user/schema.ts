import { createRecordPages, type AlienSchema } from "@alien-form/protocol";
import { modelForm, physicalField, systemFields, virtualField } from "../../utils/system-model.ts";

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
      required: true,
      private: true,
      storage: { type: "text" },
      form: { display: "none" },
      table: { hidden: true },
      filter: { hidden: true },
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
    createdAtField,
    updatedAtField,
  ];

  return {
    name: modelCode,
    title: "用户管理",
    version: 1,
    system: true,
    subtitle: "System Users",
    description: "系统登录账号与角色管理。",
    group: "system",
    singularLabel: "用户",
    pluralLabel: "用户",
    defaultPageSize: 20,
    fields,
    form: modelForm(fields, ["username", "password", "roleId"]),
    pages: createRecordPages(modelCode, "用户", ["username", "password", "roleId"]).map((page) =>
      page.router !== "list" ? page : disableAdminDelete(page, constants.adminId),
    ),
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
