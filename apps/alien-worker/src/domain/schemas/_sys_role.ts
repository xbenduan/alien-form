import type { AlienSchema } from "@alien-form/protocol";
import {
  modelForm,
  physicalField,
  recordPages,
  systemFields,
  virtualField,
} from "./system-model.ts";

export const SYS_ROLE_MODEL = "_sys_role";
export const SYS_ROLE_SUPER_ADMIN_ID = "SYSROLE000001";
export const SYS_ROLE_ADMIN_ID = "SYSROLE000002";
export const SYS_ROLE_USER_ID = "SYSROLE000003";
export const SYS_ROLE_SUPER_ADMIN = "super_admin";
export const SYS_ROLE_ADMIN = "admin";
export const SYS_ROLE_USER = "user";

const [idField, createdAtField, updatedAtField] = systemFields(SYS_ROLE_MODEL);

const fields: AlienSchema["fields"] = [
  idField,
  physicalField(SYS_ROLE_MODEL, "code", {
    type: "string",
    title: "角色编码",
    required: true,
    storage: { type: "text", unique: true, index: true },
    form: { component: "Input", props: { placeholder: "请输入角色编码" } },
  }),
  physicalField(SYS_ROLE_MODEL, "name", {
    type: "string",
    title: "角色名称",
    required: true,
    storage: { type: "text", index: true },
    form: { component: "Input", props: { placeholder: "请输入角色名称" } },
  }),
  physicalField(SYS_ROLE_MODEL, "parentId", {
    type: "string",
    title: "父级角色",
    storage: { type: "text", index: true },
    relation: {
      kind: "many-to-one",
      target: SYS_ROLE_MODEL,
      valueField: "id",
      labelField: "name",
    },
    form: {
      component: "TreeSelect",
      props: { disabledValues: "{{ $query.id ? [$query.id] : [] }}" },
    },
  }),
  virtualField(SYS_ROLE_MODEL, "canCreateModel", {
    type: "boolean",
    title: "允许新建模型",
    form: {
      component: "Select",
      default: false,
      dataSource: [
        { label: "允许", value: true },
        { label: "不允许", value: false },
      ],
    },
  }),
  virtualField(SYS_ROLE_MODEL, "description", {
    type: "string",
    title: "描述",
    form: { component: "TextArea", props: { rows: 3 } },
  }),
  virtualField(SYS_ROLE_MODEL, "permissions", {
    type: "array",
    title: "模型与字段权限",
    form: {
      component: "Card",
      items: {
        type: "object",
        properties: {
          model: {
            type: "string",
            title: "模型",
            component: "Select",
            required: true,
            "x-reaction": {
              dataSource: '{{ $service("model.options")() }}',
            },
          },
          actions: {
            type: "array",
            title: "操作权限",
            component: "Select",
            required: true,
            props: { multiple: true },
            dataSource: [
              { label: "查看", value: "read" },
              { label: "新建", value: "create" },
              { label: "编辑", value: "update" },
              { label: "删除", value: "delete" },
            ],
          },
          fields: {
            type: "array",
            title: "可查看字段",
            component: "Select",
            props: { multiple: true, onOptionsChange: "clear" },
            "x-reaction": {
              dataSource: '{{ $service("model.fieldOptions")($row.model) }}',
            },
          },
          scope: {
            type: "string",
            title: "数据范围",
            component: "Select",
            required: true,
            default: "all",
            dataSource: [
              { label: "全部数据", value: "all" },
              { label: "仅本人创建", value: "own" },
            ],
          },
        },
      },
    },
  }),
  createdAtField,
  updatedAtField,
];

export const sysRoleSchema: AlienSchema = {
  name: SYS_ROLE_MODEL,
  title: "角色管理",
  version: 0,
  system: true,
  systemRevision: 11,
  subtitle: "System Roles",
  description: "树形角色及模型、操作、字段和数据范围权限。",
  group: "system",
  singularLabel: "角色",
  pluralLabel: "角色",
  defaultPageSize: 20,
  fields,
  form: modelForm(fields, ["code", "name", "parentId", "canCreateModel", "description"]),
  pages: recordPages(SYS_ROLE_MODEL, "角色", [
    "code",
    "name",
    "parentId",
    "canCreateModel",
    "description",
  ]).map((page) => {
    if (page.router !== "list") return page;
    const content = page.slots!.content!;
    const table = content.table!;
    const rowActions = table.slots!.rowActions!;
    return {
      ...page,
      slots: {
        left: {
          tree: {
            type: "string",
            component: "tree",
            props: {
              title: "角色层级",
              model: SYS_ROLE_MODEL,
              valueField: "id",
              parentField: "parentId",
              labelField: "name",
              showRoot: true,
              loadData: '{{ $utils.tree($service("records.subtree")) }}',
            },
          },
        },
        content: {
          ...content,
          table: {
            ...table,
            props: {
              ...table.props,
              parentId: '{{ $form.getFieldValue("tree") }}',
            },
            slots: {
              ...table.slots,
              rowActions: {
                ...rowActions,
                edit: {
                  ...rowActions.edit,
                  props: {
                    ...rowActions.edit?.props,
                    disabled: `{{ ($row) => $row.id === "${SYS_ROLE_SUPER_ADMIN_ID}" }}`,
                  },
                },
                delete: {
                  ...rowActions.delete,
                  props: {
                    ...rowActions.delete?.props,
                    disabled: `{{ $row.id === "${SYS_ROLE_SUPER_ADMIN_ID}" }}`,
                    confirm: "确认删除该角色？",
                    confirmDescription: "存在子角色或关联用户时无法删除。",
                  },
                },
              },
            },
          },
        },
      },
    };
  }),
};
