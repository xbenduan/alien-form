import type { AlienSchema } from "@alien-form/protocol";
import {
  modelForm,
  physicalField,
  recordPages,
  systemFields,
  virtualField,
} from "../../global/system-model.ts";

/** Builds the role protocol from constants owned by the model entry. */
export default function createSchema(constants: {
  readonly code: string;
  readonly superAdminId: string;
}): AlienSchema {
  const modelCode = constants.code;
  const [idField, createdAtField, updatedAtField] = systemFields(modelCode);

  const fields: AlienSchema["fields"] = [
    idField,
    physicalField(modelCode, "code", {
      type: "string",
      title: "角色编码",
      required: true,
      storage: { type: "text", unique: true, index: true },
      form: { component: "Input", props: { placeholder: "请输入角色编码" } },
    }),
    physicalField(modelCode, "name", {
      type: "string",
      title: "角色名称",
      required: true,
      storage: { type: "text", index: true },
      form: { component: "Input", props: { placeholder: "请输入角色名称" } },
    }),
    physicalField(modelCode, "parentId", {
      type: "string",
      title: "父级角色",
      storage: { type: "text", index: true },
      relation: {
        kind: "many-to-one",
        target: modelCode,
        valueField: "id",
        labelField: "name",
      },
      form: {
        component: "TreeSelect",
        props: { disabledValues: "{{ $query.id ? [$query.id] : [] }}" },
      },
    }),
    virtualField(modelCode, "canCreateModel", {
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
    virtualField(modelCode, "description", {
      type: "string",
      title: "描述",
      form: { component: "TextArea", props: { rows: 3 } },
    }),
    virtualField(modelCode, "permissions", {
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

  return {
    name: modelCode,
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
    pages: recordPages(modelCode, "角色", [
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
                model: modelCode,
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
                      disabled: `{{ ($row) => $row.id === "${constants.superAdminId}" }}`,
                    },
                  },
                  delete: {
                    ...rowActions.delete,
                    props: {
                      ...rowActions.delete?.props,
                      disabled: `{{ $row.id === "${constants.superAdminId}" }}`,
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
}
