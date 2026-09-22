/**
 * Generated from the executable Runtime registry.
 * Run `pnpm generate:model-artifacts` after changing global registrations.
 */
import type { ComponentCapability, EnumCapability, RuntimeCapability } from "./capabilities.ts";

export const COMPONENT_CAPABILITIES: readonly ComponentCapability[] = [
  {
    code: "Button",
  },
  {
    code: "Card",
  },
  {
    code: "Col",
  },
  {
    code: "Divider",
  },
  {
    code: "Flex",
  },
  {
    code: "Row",
  },
  {
    code: "Space",
  },
  {
    code: "Table",
  },
  {
    code: "FormItem",
  },
  {
    code: "Input",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      sample: {
        type: "string",
        component: "Input",
        props: {
          placeholder: "请输入",
        },
      },
    },
  },
  {
    code: "TextArea",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      sample: {
        type: "string",
        component: "TextArea",
        props: {
          rows: 3,
          placeholder: "请输入",
        },
      },
    },
  },
  {
    code: "NumberInput",
    meta: {
      type: "number",
      kind: "leaf",
      dataSource: false,
      sample: {
        type: "number",
        component: "NumberInput",
        props: {
          min: 0,
        },
      },
    },
  },
  {
    code: "DatePicker",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      sample: {
        type: "string",
        component: "DatePicker",
      },
    },
  },
  {
    code: "Select",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: true,
      sample: {
        type: "string",
        component: "Select",
        dataSource: [
          {
            label: "选项一",
            value: "a",
          },
          {
            label: "选项二",
            value: "b",
          },
        ],
      },
    },
  },
  {
    code: "RemoteSelect",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      props: {
        model: {
          type: "string",
          required: true,
        },
        loadOptions: {
          type: "function",
          required: true,
          expression: true,
        },
        valueField: {
          type: "string",
          required: true,
        },
        labelField: {
          type: "string",
          required: true,
        },
        pageSize: {
          type: "number",
        },
        multiple: {
          type: "boolean",
        },
      },
      sample: {
        type: "string",
        component: "RemoteSelect",
        props: {
          model: "example_model",
          loadOptions: '{{ $utils.relation($service("records.list")) }}',
          valueField: "id",
          labelField: "name",
          pageSize: 10,
        },
      },
    },
  },
  {
    code: "TreeSelect",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      props: {
        model: {
          type: "string",
          required: true,
        },
        loadData: {
          type: "function",
          required: true,
          expression: true,
        },
        valueField: {
          type: "string",
          required: true,
        },
        parentField: {
          type: "string",
          required: true,
        },
        labelField: {
          type: "string",
          required: true,
        },
        disabledValues: {
          type: "array",
          expression: true,
        },
      },
      sample: {
        type: "string",
        component: "TreeSelect",
        props: {
          model: "example_model",
          parentField: "parentId",
          valueField: "id",
          labelField: "name",
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        },
      },
    },
  },
  {
    code: "ObjectField",
    meta: {
      type: "object",
      kind: "complex",
      children: "properties",
      sample: {
        type: "object",
        component: "ObjectField",
        props: {
          gridSpan: 12,
        },
        properties: {},
      },
    },
  },
  {
    code: "ArrayCards",
    meta: {
      type: "array",
      kind: "complex",
      children: "items",
      sample: {
        type: "array",
        component: "ArrayCards",
        props: {
          gridSpan: 12,
        },
        items: {
          type: "object",
          properties: {},
        },
      },
    },
  },
  {
    code: "row-button",
    meta: {
      scope: ["$row", "$service", "$utils", "$enums", "$query"],
      props: {
        children: {
          type: "node",
        },
        disabled: {
          type: ["boolean", "function"],
          expression: true,
        },
        onClick: {
          type: "function",
          required: true,
          expression: true,
        },
        refreshAfterSuccess: {
          type: "boolean",
        },
      },
    },
  },
  {
    code: "record-action",
    meta: {
      scope: ["$row", "$service", "$utils", "$enums", "$query"],
      props: {
        mode: {
          type: "string",
          required: true,
        },
        openMode: {
          type: "string",
        },
        children: {
          type: "node",
        },
        disabled: {
          type: ["boolean", "function"],
          expression: true,
        },
      },
    },
  },
  {
    code: "batch-button",
    meta: {
      scope: ["$service", "$utils", "$enums", "$query"],
      props: {
        children: {
          type: "node",
        },
        onClick: {
          type: "function",
          required: true,
          expression: true,
        },
        confirm: {
          type: "node",
        },
        refreshAfterSuccess: {
          type: "boolean",
        },
      },
    },
  },
  {
    code: "layout",
    meta: {
      slots: {
        left: {},
        content: {
          multiple: true,
        },
      },
    },
  },
  {
    code: "Menu",
    meta: {
      type: "void",
      kind: "leaf",
      sample: {
        type: "void",
        component: "Menu",
        props: {
          title: "菜单",
          items: [
            {
              key: "one",
              label: "菜单项一",
            },
            {
              key: "two",
              label: "菜单项二",
            },
          ],
        },
      },
    },
  },
  {
    code: "filter",
  },
  {
    code: "table",
    meta: {
      slots: {
        toolbar: {
          multiple: true,
        },
        batchActions: {
          multiple: true,
        },
        rowActions: {
          multiple: true,
          scope: ["$row"],
        },
      },
      scope: ["$form", "$query", "$service", "$utils", "$enums"],
      props: {
        rowKey: {
          type: "string",
        },
        modelCode: {
          type: "string",
          required: true,
        },
        schema: {
          type: "object",
          required: true,
        },
        columns: {
          type: ["array", "function"],
          required: true,
          expression: true,
        },
        filter: {
          type: "object",
          expression: true,
        },
        parentId: {
          type: ["string", "number"],
          expression: true,
        },
        loadData: {
          type: "function",
          required: true,
          expression: true,
        },
      },
    },
  },
  {
    code: "tree",
    meta: {
      type: "string",
      kind: "leaf",
      props: {
        model: {
          type: "string",
          required: true,
        },
        loadData: {
          type: "function",
          required: true,
          expression: true,
        },
        valueField: {
          type: "string",
          required: true,
        },
        parentField: {
          type: "string",
          required: true,
        },
        labelField: {
          type: "string",
          required: true,
        },
        showRoot: {
          type: "boolean",
        },
      },
      sample: {
        type: "string",
        component: "tree",
        props: {
          model: "example_model",
          valueField: "id",
          parentField: "parentId",
          labelField: "name",
          showRoot: false,
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        },
      },
    },
  },
  {
    code: "record-page",
  },
  {
    code: "record-form",
  },
  {
    code: "overlay",
  },
];
export const SERVICE_CAPABILITIES: readonly RuntimeCapability[] = [
  {
    code: "auth.login",
    description: "登录",
  },
  {
    code: "auth.logout",
    description: "退出登录",
  },
  {
    code: "model.list",
    description: "查询模型列表",
  },
  {
    code: "model.get",
    description: "读取模型",
  },
  {
    code: "model.options",
    description: "查询模型选项",
  },
  {
    code: "model.fieldOptions",
    description: "查询模型字段选项",
  },
  {
    code: "model.create",
    description: "创建模型",
  },
  {
    code: "model.update",
    description: "更新模型",
  },
  {
    code: "model.delete",
    description: "删除模型",
  },
  {
    code: "records.list",
    description: "查询记录列表",
  },
  {
    code: "records.subtree",
    description: "查询树形记录",
  },
  {
    code: "records.get",
    description: "读取记录",
  },
  {
    code: "records.create",
    description: "创建记录",
  },
  {
    code: "records.update",
    description: "更新记录",
  },
  {
    code: "records.delete",
    description: "删除记录",
  },
  {
    code: "records.batchDelete",
    description: "批量删除记录",
  },
  {
    code: "record.add",
    description: "提交新增表单",
  },
  {
    code: "record.edit",
    description: "提交编辑表单",
  },
];
export const UTILITY_CAPABILITIES: readonly RuntimeCapability[] = [
  {
    code: "schemaToColumns",
    description: "表单字段转表格列",
  },
  {
    code: "schemaToFilterFields",
    description: "表单字段转筛选项",
  },
  {
    code: "relation",
    description: "关联选项适配器",
  },
  {
    code: "tree",
    description: "树形数据适配器",
  },
  {
    code: "message",
    description: "消息反馈",
  },
  {
    code: "openRoute",
    description: "打开记录路由",
  },
];
export const ENUM_CAPABILITIES: readonly EnumCapability[] = [
  {
    code: "fieldTypes",
    description: "字段类型",
    value: [
      {
        label: "文本",
        value: "string",
      },
      {
        label: "数字",
        value: "number",
      },
      {
        label: "布尔",
        value: "boolean",
      },
      {
        label: "对象",
        value: "object",
      },
      {
        label: "数组",
        value: "array",
      },
    ],
  },
  {
    code: "status",
    description: "启停状态",
    value: [
      {
        label: "启用",
        value: "active",
      },
      {
        label: "停用",
        value: "inactive",
      },
    ],
  },
];
