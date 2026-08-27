import type { Runtime } from "@alien-form/engine";
import type { IFieldSchema } from "@alien-form/core";
import type {
  ModelFieldSchema,
  ProjectionContext,
  RegisteredFieldDefinition,
} from "../domains/model/builder/types";
import { multiValueFormat } from "./field-values";
import type { TableColumn } from "@app-types/shared";

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

/** 构建字段组件的默认 schema。 */
export const base = (
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

export const objectProjection: RegisteredFieldDefinition["projection"] = {
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

export const arrayProjection: RegisteredFieldDefinition["projection"] = {
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

export const selectProjection: RegisteredFieldDefinition["projection"] = {
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

/** 构建并直接注册一个字段组件（业务不再套一层 fieldDefinitions 映射）。 */
export function registerFieldComponent(
  runtime: Runtime,
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
): void {
  const definition: RegisteredFieldDefinition = {
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
  runtime.formComponent(definition);
}
