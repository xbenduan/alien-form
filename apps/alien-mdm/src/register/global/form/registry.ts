import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Registry } from "@alien-form/engine";
import type { IFieldSchema } from "@alien-form/core";
import type {
  ModelFieldDefinition,
  ModelFieldSchema,
  ProjectionContext,
} from "../../../domains/model/builder/types";
import { multiValueFormat } from "../../../utils/field-values";
import type {
  ComponentMeta,
  ComponentOption,
  FieldComponentProps,
  TableColumn,
} from "../../../types/shared";

export interface RegisteredFieldDefinition extends ModelFieldDefinition {
  component: LazyExoticComponent<ComponentType<FieldComponentProps>>;
  fieldType: ComponentMeta["fieldType"];
}

function tableMeta(field: ModelFieldSchema) {
  return field["x-table"] ?? {};
}

function sortable(field: ModelFieldSchema, fallback: boolean): boolean {
  return field["x-database"]?.sortable ?? field["x-table"]?.sortable ?? fallback;
}

function filterBase(field: ModelFieldSchema, key: string): IFieldSchema {
  const { required: _required, default: _default, "x-validate": _validate, ...rest } = field;
  return { ...(rest as IFieldSchema), title: field.title ?? key, decorator: "FilterItem" };
}

function leafColumn(field: ModelFieldSchema, key: string): TableColumn {
  const meta = tableMeta(field);
  const complex = field.type === "object" || field.type === "array";
  return {
    key,
    title:
      field.title ??
      (typeof field.props?.title === "string" ? field.props.title : undefined) ??
      key,
    width: meta.width,
    ellipsis: meta.ellipsis ?? true,
    sortable: sortable(field, !complex),
    complex,
    component: field.component,
    dataSource: Array.isArray(field.dataSource) ? field.dataSource : undefined,
    field: { ...(field as IFieldSchema) },
  };
}

function complexColumn(field: ModelFieldSchema, key: string, formField: IFieldSchema): TableColumn {
  const meta = tableMeta(field);
  return {
    key,
    title: field.title ?? (typeof field.props?.title === "string" ? field.props.title : key),
    width: meta.width,
    ellipsis: meta.ellipsis ?? true,
    sortable: sortable(field, false),
    complex: true,
    component: field.component,
    field: formField,
  };
}

function leafProjection() {
  return {
    toForm: (field: ModelFieldSchema) => ({ ...(field as IFieldSchema) }),
    toFilter: (field: ModelFieldSchema, key: string) => {
      const base = filterBase(field, key);
      return field.component === "Textarea"
        ? { ...base, props: { ...field.props, rows: 1 } }
        : base;
    },
    toColumn: (field: ModelFieldSchema, key: string) => leafColumn(field, key),
  };
}

function definition(
  code: string,
  component: RegisteredFieldDefinition["component"],
  fieldType: RegisteredFieldDefinition["fieldType"],
  title: string,
  kind: RegisteredFieldDefinition["authoring"]["kind"],
  description: string,
  schema: ModelFieldSchema,
  options: {
    children?: RegisteredFieldDefinition["authoring"]["children"];
    projection?: RegisteredFieldDefinition["projection"];
  } = {},
): RegisteredFieldDefinition {
  return {
    code,
    title,
    description,
    component,
    fieldType,
    authoring: {
      kind,
      children: options.children,
      create: () => structuredClone(schema),
    },
    projection: options.projection ?? leafProjection(),
  };
}

const base = (
  type: ModelFieldSchema["type"],
  title: string,
  component: string,
  props: Record<string, unknown>,
  width: number,
): ModelFieldSchema => ({
  type,
  title,
  component,
  props,
  required: false,
  disabled: false,
  display: "visible",
  "x-validate": "",
  "x-table": { width, visible: true },
});

const objectProjection: RegisteredFieldDefinition["projection"] = {
  toForm(field, context) {
    const ctx = context as ProjectionContext;
    return {
      ...(field as IFieldSchema),
      type: "object",
      title: undefined,
      props: { ...field.props, title: field.props?.title ?? field.title ?? "" },
      component: field.component ?? "ObjectField",
      properties: ctx.projectProperties(field.properties ?? {}),
    };
  },
  toFilter: () => undefined,
  toColumn(field, key, context) {
    return complexColumn(field, key, objectProjection.toForm(field, context));
  },
};

const arrayProjection: RegisteredFieldDefinition["projection"] = {
  toForm(field, context) {
    const ctx = context as ProjectionContext;
    const items = field.items && !Array.isArray(field.items) ? field.items : undefined;
    return {
      ...(field as IFieldSchema),
      type: "array",
      title: undefined,
      props: { ...field.props, title: field.props?.title ?? field.title ?? "" },
      component: field.component ?? "ArrayCards",
      items: items?.properties
        ? {
            ...(items as IFieldSchema),
            type: "object",
            properties: ctx.projectProperties(items.properties),
          }
        : (items as IFieldSchema | undefined),
    };
  },
  toFilter: () => undefined,
  toColumn(field, key, context) {
    return complexColumn(field, key, arrayProjection.toForm(field, context));
  },
};

const selectProjection: RegisteredFieldDefinition["projection"] = {
  toForm(field) {
    const multiple = field.props?.selectMode === "multiple" || field.props?.selectMode === "tags";
    return {
      ...(field as IFieldSchema),
      ...(multiple ? { type: "string", "x-format": multiValueFormat } : {}),
    };
  },
  toFilter(field, key, context) {
    return { ...filterBase(field, key), ...selectProjection.toForm(field, context) };
  },
  toColumn: (field, key) => leafColumn(field, key),
};

export const fieldDefinitions: Record<string, RegisteredFieldDefinition> = {
  Input: definition(
    "Input",
    lazy(() => import("./input")),
    "string",
    "单行文本",
    "leaf",
    "适用于姓名、标题等短文本。",
    base("string", "单行文本", "Input", { placeholder: "请输入" }, 100),
  ),
  Textarea: definition(
    "Textarea",
    lazy(() => import("./textarea")),
    "string",
    "多行文本",
    "leaf",
    "适用于备注、简介等长文本。",
    base("string", "多行文本", "Textarea", { placeholder: "请输入", rows: 4 }, 160),
  ),
  NumberInput: definition(
    "NumberInput",
    lazy(() => import("./number-input")),
    "number",
    "数字",
    "leaf",
    "适用于金额、数量、年龄等数值。",
    base("number", "数字", "NumberInput", { placeholder: "请输入" }, 100),
  ),
  Select: definition(
    "Select",
    lazy(() => import("./select")),
    "string",
    "下拉选择",
    "leaf",
    "支持静态选项和通过 props.service 声明的远程选项。",
    {
      ...base("string", "下拉单选", "Select", { placeholder: "请选择" }, 100),
      dataSource: [
        { label: "选项 1", value: "1" },
        { label: "选项 2", value: "2" },
      ],
    },
    { projection: selectProjection },
  ),
  DateInput: definition(
    "DateInput",
    lazy(() => import("./date-input")),
    "string",
    "日期",
    "leaf",
    "值以 YYYY-MM-DD 字符串存储。",
    base("string", "日期", "DateInput", { placeholder: "请选择" }, 120),
  ),
  TreeSelect: definition(
    "TreeSelect",
    lazy(() => import("./tree-select")),
    "string",
    "树形单选",
    "leaf",
    "从模型的父子关系构建树形选项。",
    base(
      "string",
      "树形单选",
      "TreeSelect",
      {
        placeholder: "请选择",
        treeModel: "",
        treeIdField: "id",
        treeLabelField: "id",
        treeParentField: "parentCode",
      },
      160,
    ),
  ),
  ObjectField: definition(
    "ObjectField",
    lazy(() => import("./object-field")),
    "object",
    "对象分组",
    "complex",
    "管理嵌套对象子字段。",
    {
      ...base("object", "对象分组", "ObjectField", { columns: 2, gutter: 16 }, 160),
      properties: {},
    },
    { children: "properties", projection: objectProjection },
  ),
  ArrayCards: definition(
    "ArrayCards",
    lazy(() => import("./array-cards")),
    "array",
    "对象数组",
    "complex",
    "以卡片列表管理同构对象数组。",
    {
      ...base("array", "对象数组", "ArrayCards", { columns: 2, gutter: 16 }, 160),
      items: { type: "object", properties: {} },
    },
    { children: "items", projection: arrayProjection },
  ),
  GridLayout: definition(
    "GridLayout",
    lazy(() => import("./grid-layout")),
    "object",
    "栅格布局",
    "layout",
    "不占数据路径的表单栅格容器。",
    {
      type: "void",
      title: "栅格布局",
      component: "GridLayout",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      properties: {},
    },
  ),
};

export function getFieldDefinition(
  registry: Registry,
  code?: string,
  domain?: string,
): RegisteredFieldDefinition | undefined {
  return code
    ? (registry.form.components.resolve(code, domain) as RegisteredFieldDefinition | undefined)
    : undefined;
}

export function getFieldComponents(
  registry: Registry,
  domain?: string,
): Record<string, RegisteredFieldDefinition["component"]> {
  return Object.fromEntries(
    Object.entries(registry.form.components.all(domain)).map(([code, definition]) => [
      code,
      definition.component,
    ]),
  ) as Record<string, RegisteredFieldDefinition["component"]>;
}

export function getFieldDecorators(
  registry: Registry,
  domain?: string,
): Record<string, ComponentType<unknown>> {
  return Object.fromEntries(
    Object.entries(registry.form.decorators.all(domain)).map(([code, definition]) => [
      code,
      definition.component,
    ]),
  ) as Record<string, ComponentType<unknown>>;
}

export function buildComponentOptions(
  registry: Registry,
  filter?: (definition: RegisteredFieldDefinition) => boolean,
  domain?: string,
): ComponentOption[] {
  return Object.values(
    registry.form.components.all(domain) as Record<string, RegisteredFieldDefinition>,
  )
    .filter((definition) => (filter ? filter(definition) : true))
    .map((definition) => ({ value: definition.code, label: definition.title }));
}

export function isContainerComponent(
  registry: Registry,
  component?: string,
  domain?: string,
): boolean {
  return Boolean(getFieldDefinition(registry, component, domain)?.authoring.children);
}

export function getDefaultFieldSchema(
  registry: Registry,
  component: string,
  domain?: string,
): ModelFieldSchema {
  const definition =
    getFieldDefinition(registry, component, domain) ??
    getFieldDefinition(registry, "Input", domain);
  if (!definition) throw new Error(`[alien-mdm] field definition "${component}" not found`);
  return definition.authoring.create();
}
