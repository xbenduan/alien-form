import type { DatabaseField, FieldSchema, Runtime } from "@engine";
import type {
  BuilderSchema,
  FieldNode,
  FieldType,
  FormConfig,
  GroupDraft,
  ModelDraft,
  StorageConfig,
} from "./types";
import { createDefaultPages } from "./page-templates";

let idCounter = 0;
/** 生成命令寻址用的稳定 id。 */
export function createId(): string {
  idCounter += 1;
  return `af-${Date.now().toString(36)}-${idCounter}`;
}

const COLUMN_FOR_TYPE: Record<FieldType, StorageConfig["type"]> = {
  string: "text",
  number: "real",
  boolean: "boolean",
  object: "json",
  array: "json",
  void: "text",
};

/** 组件是否为容器（object→properties / array→items）。 */
export function containerKind(
  runtime: Runtime,
  component?: string,
  domain?: string,
): "properties" | "items" | undefined {
  if (!component) return undefined;
  const registration = runtime.resolveComponent(component, domain);
  return registration?.meta?.children;
}

export function isContainer(runtime: Runtime, node: FieldNode, domain?: string): boolean {
  return Boolean(containerKind(runtime, node.form.component, domain));
}

/** form-schema 字段可选组件：只列 adapter==="form" 的组件（约束：form-schema 只能用 form）。 */
export function componentOptions(
  runtime: Runtime,
  domain?: string,
): { label: string; value: string }[] {
  return runtime
    .componentCodes(domain)
    .filter((code) => runtime.resolveComponent(code, domain)?.adapter === "form")
    .map((code) => ({ label: code, value: code }));
}

/** 依据组件推断字段类型。 */
export function typeForComponent(runtime: Runtime, component: string, domain?: string): FieldType {
  const meta = runtime.resolveComponent(component, domain)?.meta;
  if (meta?.children === "items") return "array";
  if (meta?.children === "properties") return "object";
  if (meta?.type === "number") return "number";
  if (meta?.type === "boolean") return "boolean";
  return "string";
}

/** 取组件注册的示例 schema（新增字段选组件时带出，编辑不带出）。 */
export function componentSample(
  runtime: Runtime,
  component: string,
  domain?: string,
): Partial<FieldSchema> | undefined {
  return runtime.resolveComponent(component, domain)?.meta?.sample;
}

/** 新建一个字段节点（默认 Input，落库字段）。 */
export function createField(
  runtime: Runtime,
  options: { component?: string; source?: FieldNode["source"]; domain?: string } = {},
): FieldNode {
  const component = options.component ?? "Input";
  const source = options.source ?? "field";
  const type = typeForComponent(runtime, component, options.domain);
  const key = `field_${idCounter + 1}`;
  const node: FieldNode = {
    id: createId(),
    key,
    type,
    source,
    // 表单表现默认值（form-schema ⊇ fields：落库字段必须有对应表现描述，组件按类型推断）。
    form: { title: "新字段", component },
  };
  if (source === "field") {
    node.storage = {
      title: "新字段",
      type: COLUMN_FOR_TYPE[type],
      ...(type === "object" || type === "array" ? { valueType: type } : {}),
    };
  }
  if (type === "object" || type === "array") node.children = [];
  return node;
}

// --------------------------------------------------------------------------
// decode: BuilderSchema -> ModelDraft
// --------------------------------------------------------------------------

function decodeFormConfig(schema: FieldSchema | undefined): FormConfig {
  if (!schema) return {};
  // 保留全部 IFieldSchema 表现字段；properties/items 由 FieldNode.children 承载，剔除。
  const rest: Record<string, unknown> = { ...schema };
  delete rest.properties;
  delete rest.items;
  return rest as FormConfig;
}

function decodeChildren(schema: FieldSchema | undefined): FieldNode[] {
  const properties =
    schema?.type === "array"
      ? schema.items && !Array.isArray(schema.items)
        ? schema.items.properties
        : undefined
      : schema?.properties;
  if (!properties) return [];
  return Object.entries(properties).map(([key, child]) => decodeExtraNode(key, child));
}

/** 解码非落库的嵌套子字段（source=extra）。 */
function decodeExtraNode(key: string, schema: FieldSchema): FieldNode {
  const type = (schema.type ?? "string") as FieldType;
  const node: FieldNode = {
    id: createId(),
    key,
    type,
    source: "extra",
    form: decodeFormConfig(schema),
  };
  if (type === "object" || type === "array") node.children = decodeChildren(schema);
  return node;
}

/**
 * 源码编辑：把手动编辑后的 form-schema.properties 应用回字段树。
 * 落库字段（source==="field"）保留 storage/id/type/source，仅覆盖 form 与 children；
 * 未出现的落库字段保持不变（form-schema ⊇ fields 由校验保证），额外 key 作为 extra 展示字段。
 */
export function applyFormSchema(
  current: FieldNode[],
  properties: Record<string, FieldSchema>,
): FieldNode[] {
  const byKey = new Map(current.map((node) => [node.key, node]));
  const result: FieldNode[] = [];
  for (const [key, schema] of Object.entries(properties)) {
    const existing = byKey.get(key);
    if (existing && existing.source === "field") {
      result.push({
        ...existing,
        form: decodeFormConfig(schema),
        children:
          existing.type === "object" || existing.type === "array"
            ? decodeChildren(schema)
            : undefined,
      });
    } else {
      result.push(decodeExtraNode(key, schema));
    }
  }
  // 保留未在 properties 中出现的落库字段（避免误删存储定义）。
  for (const node of current) {
    if (node.source === "field" && !properties[node.key]) result.push(node);
  }
  return result;
}

function storageFromField(field: DatabaseField): StorageConfig {
  return {
    title: field.title,
    type: field.type,
    valueType: field.valueType,
    column: field.column,
    system: field.system,
    nullable: field.nullable,
    default: field.default,
    unique: field.unique,
    index: field.index,
    visible: field.visible,
    filterable: field.filterable,
    sortable: field.sortable,
    relation: field.relation,
  };
}

function fieldType(field: DatabaseField): FieldType {
  if (field.valueType) return field.valueType;
  if (field.type === "integer" || field.type === "real") return "number";
  if (field.type === "boolean") return "boolean";
  if (field.type === "json") return "object";
  return "string";
}

export function decodeModel(model: BuilderSchema): ModelDraft {
  const properties = model.definitions["form-schema"].properties ?? {};
  const fieldKeys = new Set(model.fields.map((field) => field.key));
  const fields: FieldNode[] = model.fields.map((field) => {
    const schema = properties[field.key];
    const type = fieldType(field);
    const node: FieldNode = {
      id: createId(),
      key: field.key,
      type,
      source: "field",
      storage: storageFromField(field),
      form: decodeFormConfig(schema),
    };
    if (type === "object" || type === "array") node.children = decodeChildren(schema);
    return node;
  });
  // form-schema 中额外的 void 展示元素（不落库）。
  for (const [key, schema] of Object.entries(properties)) {
    if (fieldKeys.has(key)) continue;
    fields.push(decodeExtraNode(key, schema));
  }
  const pages: ModelDraft["pages"] =
    model.pages.length > 0
      ? model.pages.map((page) => ({ id: createId(), page }))
      : createDefaultPages(model.meta.name, model.meta.title).map((page) => ({
          id: createId(),
          page,
        }));
  return {
    name: model.meta.name,
    title: model.meta.title,
    subtitle: model.meta.subtitle,
    description: model.meta.description,
    group: model.meta.group ?? "other",
    singularLabel: model.meta.singularLabel,
    pluralLabel: model.meta.pluralLabel,
    defaultPageSize: model.meta.defaultPageSize ?? 20,
    fields,
    groups: (model.definitions["form-schema"].group ?? []).map((group) => ({
      ...group,
      id: createId(),
    })),
    pages,
  };
}

// --------------------------------------------------------------------------
// encode: ModelDraft -> BuilderSchema
// --------------------------------------------------------------------------

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function encodeFormSchema(node: FieldNode): FieldSchema {
  // 落库字段的 required 由存储 nullable 派生（form-schema 不定义存储语义）；
  // 表单新增字段(extra)的 required 由 form 自身决定。
  const required =
    node.source === "field" ? node.storage?.nullable === false : node.form.required === true;
  // 保留 form 上的全部 IFieldSchema 表现字段，再以 type/required 覆盖，properties/items 单独生成。
  const base: Record<string, unknown> = { ...node.form };
  delete base.properties;
  delete base.items;
  const schema: FieldSchema = pruneUndefined({
    ...base,
    type: node.type,
    required: required || undefined,
  }) as FieldSchema;
  if (node.type === "object") {
    schema.properties = Object.fromEntries(
      (node.children ?? []).map((child) => [child.key, encodeFormSchema(child)]),
    );
  }
  if (node.type === "array") {
    schema.items = {
      type: "object",
      properties: Object.fromEntries(
        (node.children ?? []).map((child) => [child.key, encodeFormSchema(child)]),
      ),
    };
  }
  return schema;
}

function encodeDatabaseField(node: FieldNode): DatabaseField {
  // 完全从 storage 取值；不读取任何 form 表现配置。
  const storage = node.storage ?? { type: COLUMN_FOR_TYPE[node.type] };
  return pruneUndefined({
    key: node.key,
    title: storage.title,
    type: storage.type,
    valueType: storage.valueType,
    column: storage.column,
    system: storage.system || undefined,
    nullable: storage.nullable,
    default: storage.default,
    unique: storage.unique || undefined,
    index: storage.index || undefined,
    visible: storage.visible,
    filterable: storage.filterable || undefined,
    sortable: storage.sortable,
    relation: storage.relation,
  }) as DatabaseField;
}

export function encodeModel(draft: ModelDraft): BuilderSchema {
  const name = draft.name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
    throw new Error("模型名只能使用字母、数字、下划线和中划线，且必须以字母或下划线开头");
  }
  const title = draft.title.trim();
  if (!title) throw new Error("模型标题必填");
  if (draft.fields.length === 0) throw new Error("至少需要一个字段");

  const seen = new Set<string>();
  for (const node of draft.fields) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(node.key)) throw new Error(`字段名不合法：${node.key}`);
    if (seen.has(node.key)) throw new Error(`字段名重复：${node.key}`);
    seen.add(node.key);
  }

  const properties = Object.fromEntries(
    draft.fields.map((node) => [node.key, encodeFormSchema(node)]),
  );
  const dbFields = draft.fields
    .filter((node) => node.source === "field")
    .map((node) => encodeDatabaseField(node));
  if (dbFields.length === 0) throw new Error("至少需要一个落库字段");

  const group = draft.groups
    .filter((item) => item.keys.length > 0)
    .map(
      (item) =>
        pruneUndefined({
          component: item.component?.trim() || "ObjectField",
          title: item.title,
          description: item.description,
          keys: item.keys,
          props: item.props,
        }) as GroupDraft,
    );

  return {
    meta: pruneUndefined({
      name,
      title,
      subtitle: draft.subtitle?.trim() || undefined,
      description: draft.description?.trim() || undefined,
      group: draft.group,
      singularLabel: draft.singularLabel?.trim() || title,
      pluralLabel: draft.pluralLabel?.trim() || title,
      defaultPageSize: draft.defaultPageSize,
    }) as BuilderSchema["meta"],
    fields: dbFields,
    pages:
      draft.pages.length > 0
        ? draft.pages.map((item) => item.page)
        : createDefaultPages(name, title),
    definitions: {
      "form-schema": {
        type: "object",
        properties,
        ...(group.length > 0 ? { group } : {}),
      },
    },
  };
}
