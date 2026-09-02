// Alien-Form page protocol. This file is the canonical authoring contract.

export type Expr = `{{${string}}}`;
export type Ref = { $ref: string };
export type PropValue =
  | string
  | number
  | boolean
  | null
  | Ref
  | PropValue[]
  | { [key: string]: PropValue };

export interface FieldGroup {
  component?: string;
  keys: string[];
  title?: string;
  description?: string;
  props?: Record<string, PropValue>;
}

export interface FieldSchema {
  type?: "string" | "number" | "boolean" | "object" | "array" | "void";
  title?: string;
  description?: string;
  component?: string;
  required?: boolean;
  default?: PropValue;
  props?: Record<string, PropValue>;
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema;
  group?: FieldGroup[];
  $ref?: string;
  dataSource?: PropValue | Expr;
  "x-reaction"?: Record<string, PropValue | Expr>;
  "x-format"?: {
    input?: Expr;
    output?: Expr;
  };
  "x-database"?: {
    type?: "text" | "integer" | "real" | "boolean" | "json";
    column?: string;
    length?: number;
    nullable?: boolean;
    unique?: boolean;
    index?: boolean;
    filterable?: boolean;
  };
  "x-table"?: {
    visible?: boolean;
    width?: number;
    fixed?: "left" | "right";
    filterable?: boolean;
  };
}

export interface XPage {
  router: string;
  title?: string;
  layout?: {
    component: string;
    props?: Record<string, PropValue>;
  };
  schema: {
    properties: Record<string, FieldSchema>;
  };
}

export interface BuilderSchema {
  meta: {
    name: string;
    title: string;
    description?: string;
    openMode?: string;
    defaultPageSize?: number;
  };
  "x-pages": XPage[];
  definitions: {
    "form-schema": FieldSchema;
    [key: string]: FieldSchema;
  };
}

export const builderSchema: BuilderSchema = {
  meta: {
    name: "_sys_models",
    title: "模型管理",
    openMode: "route",
    defaultPageSize: 20,
  },
  "x-pages": [
    {
      router: "list",
      layout: {
        component: "layout",
        props: {
          left: "tree",
          rightTop: "filter",
          rightBottom: "table",
        },
      },
      schema: {
        properties: {
          tree: {
            type: "string",
            component: "tree",
            props: {
              loadData: "{{ $service.models.tree }}",
            },
          },
          filter: {
            type: "string",
            component: "filter",
            props: {
              schema: { $ref: "form-schema" },
              fields: "{{ $utils.schemaTofields }}",
              defaultValue: "{{ $query.keyword }}",
            },
          },
          table: {
            type: "void",
            component: "table",
            props: {
              rowKey: "id",
              columns: "{{ $utils.schemaToColumns }}",
              schema: { $ref: "form-schema" },
              filter: "{{ $values.filter }}",
              nodeId: "{{ $values.tree }}",
              loadData: "{{ (params) => $service.records.list(params) }}",
              toolbar: "toolbar",
            },
            properties: {
              toolbar: {
                type: "void",
                component: "Flex",
                props: { gap: 8 },
                properties: {
                  add: {
                    type: "void",
                    component: "Button",
                    props: {
                      type: "primary",
                      children: "新增",
                      onClick: "{{ () => $service.router.go('add') }}",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      router: "add",
      schema: {
        properties: {
          form: {
            type: "void",
            component: "record-form",
            props: {
              mode: "add",
              modelCode: "_sys_models",
              schema: { $ref: "form-schema" },
            },
          },
        },
      },
    },
    {
      router: "edit",
      schema: {
        properties: {
          form: {
            type: "void",
            component: "record-form",
            props: {
              mode: "edit",
              modelCode: "_sys_models",
              recordId: "{{ $query.id }}",
              schema: { $ref: "form-schema" },
            },
          },
        },
      },
    },
  ],
  definitions: {
    "form-schema": {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "模型名称",
          component: "Input",
          "x-database": {
            type: "text",
            column: "name",
            length: 128,
            index: true,
            filterable: true,
          },
          "x-table": { filterable: true },
        },
        status: {
          type: "string",
          title: "状态",
          component: "Select",
          dataSource: [
            { label: "启用", value: "active" },
            { label: "停用", value: "inactive" },
          ],
          "x-database": { type: "text", column: "status" },
        },
      },
      group: [
        {
          component: "ObjectField",
          title: "基础信息",
          keys: ["name", "status"],
        },
      ],
    },
  },
};
