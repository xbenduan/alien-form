import type { ModelFieldSchema, DatabaseRelation, FieldSchema, Runtime } from "@alien-form/engine";
import { parseModelSchema } from "@alien-form/protocol";
import type {
  ModelSchema,
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

const COMPONENT_FOR_TYPE: Record<FieldType, string> = {
  string: "Input",
  number: "NumberInput",
  boolean: "Select",
  object: "ObjectField",
  array: "ArrayCards",
  void: "Input",
};

/** relation 是关联表单表现的唯一真相源，组件与远程加载 props 不允许独立漂移。 */
export function synchronizeRelationForm(
  form: FormConfig,
  type: FieldType,
  relation?: DatabaseRelation,
): FormConfig {
  if (!relation) {
    if (form.component !== "RemoteSelect") return form;
    const props = { ...form.props };
    delete props.model;
    delete props.loadOptions;
    delete props.valueField;
    delete props.labelField;
    delete props.pageSize;
    delete props.multiple;
    return {
      ...form,
      component: COMPONENT_FOR_TYPE[type],
      dataSource: undefined,
      props: Object.keys(props).length > 0 ? props : undefined,
    };
  }

  const props = { ...form.props };
  delete props.model;
  delete props.loadOptions;
  delete props.valueField;
  delete props.labelField;
  delete props.pageSize;
  delete props.multiple;
  return {
    ...form,
    component: "RemoteSelect",
    dataSource: undefined,
    props: {
      ...props,
      model: relation.target,
      loadOptions: '{{ $utils.relation($service("records.list")) }}',
      valueField: relation.valueField ?? "id",
      labelField: relation.labelField ?? "name",
      pageSize: 10,
      ...(relation.kind === "many-to-many" ? { multiple: true } : {}),
    },
  };
}

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
  const source = options.source ?? "physical";
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
  if (source === "physical") {
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
// decode: ModelSchema -> ModelDraft
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
  return Object.entries(properties).map(([key, child]) => decodeVirtualNode(key, child));
}

/** 解码 virtual 字段或嵌套字段。 */
function decodeVirtualNode(key: string, schema: FieldSchema): FieldNode {
  const type = (schema.type ?? "string") as FieldType;
  const node: FieldNode = {
    id: createId(),
    key,
    type,
    source: "virtual",
    form: decodeFormConfig(schema),
  };
  if (type === "object" || type === "array") node.children = decodeChildren(schema);
  return node;
}

/**
 * 源码编辑：把手动编辑后的 form-schema.properties 应用回字段树。
 * physical 字段保留 storage/id/type/source，仅覆盖 form 与 children；
 * 新字段作为 virtual 字段加入。
 */
export function applyFormSchema(
  current: FieldNode[],
  properties: Record<string, FieldSchema>,
): FieldNode[] {
  const byKey = new Map(current.map((node) => [node.key, node]));
  const result: FieldNode[] = [];
  for (const [key, schema] of Object.entries(properties)) {
    const existing = byKey.get(key);
    if (existing) {
      result.push({
        ...existing,
        form: synchronizeRelationForm(
          decodeFormConfig(schema),
          existing.type,
          existing.storage?.relation,
        ),
        children:
          existing.type === "object" || existing.type === "array"
            ? decodeChildren(schema)
            : undefined,
      });
    } else {
      result.push(decodeVirtualNode(key, schema));
    }
  }
  // 保留未在 properties 中出现的 physical 字段，virtual 字段允许从表单配置移除。
  for (const node of current) {
    if (node.source === "physical" && !properties[node.key]) result.push(node);
  }
  return result;
}

function storageFromField(field: ModelFieldSchema): StorageConfig {
  const database = field.database;
  if (!database) throw new Error(`physical 字段缺少 database：${field.key}`);
  return {
    title: field.table?.title,
    type: database.type,
    valueType: database.valueType,
    column: database.column,
    system: database.system,
    nullable: database.nullable,
    default: database.default ?? undefined,
    unique: database.unique,
    index: database.index,
    visible: field.table?.hidden ? false : undefined,
    filterable: field.filter?.hidden ? false : undefined,
    relation: field.relation,
  };
}

function fieldType(field: ModelFieldSchema): FieldType {
  return (field.form.type ?? "string") as FieldType;
}

export function decodeModel(model: ModelSchema): ModelDraft {
  const fields: FieldNode[] = model.fields.map((field) => {
    const type = fieldType(field);
    const node: FieldNode = {
      id: field.id,
      key: field.key,
      type,
      source: field.storage,
      persisted: true,
      storage: field.storage === "physical" ? storageFromField(field) : undefined,
      form: decodeFormConfig(field.form),
    };
    node.form = synchronizeRelationForm(node.form, type, field.relation);
    if (type === "object" || type === "array") node.children = decodeChildren(field.form);
    return node;
  });
  const pages: ModelDraft["pages"] =
    model.pages.length > 0
      ? model.pages.map((page) => ({ id: createId(), page }))
      : createDefaultPages(model.name, model.title).map((page) => ({
          id: createId(),
          page,
        }));
  const groups = model.pages.find((page) => page.groups?.length)?.groups ?? [];
  return {
    name: model.name,
    title: model.title,
    version: model.version,
    subtitle: model.subtitle,
    description: model.description,
    group: model.group ?? "other",
    singularLabel: model.singularLabel,
    pluralLabel: model.pluralLabel,
    defaultPageSize: model.defaultPageSize ?? 20,
    definitions: model.definitions,
    fields,
    groups: groups.map((group) => ({
      ...group,
      id: createId(),
    })),
    pages,
  };
}

// --------------------------------------------------------------------------
// encode: ModelDraft -> ModelSchema
// --------------------------------------------------------------------------

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function encodeFormSchema(node: FieldNode): FieldSchema {
  // 落库字段的 required 由存储 nullable 派生（form-schema 不定义存储语义）；
  // 表单新增字段(extra)的 required 由 form 自身决定。
  const required =
    node.source === "physical" ? node.storage?.nullable === false : node.form.required === true;
  // 保留 form 上的全部 IFieldSchema 表现字段，再以 type/required 覆盖，properties/items 单独生成。
  const form = synchronizeRelationForm(node.form, node.type, node.storage?.relation);
  const base: Record<string, unknown> = { ...form };
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
  if (node.type === "array" && !node.storage?.relation) {
    schema.items = {
      type: "object",
      properties: Object.fromEntries(
        (node.children ?? []).map((child) => [child.key, encodeFormSchema(child)]),
      ),
    };
  }
  return schema;
}

function encodeModelField(node: FieldNode): ModelFieldSchema {
  const storage = node.storage ?? { type: COLUMN_FOR_TYPE[node.type] };
  const form = encodeFormSchema(node);
  return pruneUndefined({
    id: node.id,
    key: node.key,
    storage: node.source,
    database:
      node.source === "physical"
        ? pruneUndefined({
            type: storage.type,
            valueType: storage.valueType,
            column: storage.column,
            system: storage.system || undefined,
            nullable: storage.nullable,
            default: storage.default,
            unique: storage.unique || undefined,
            index: storage.index || undefined,
          })
        : undefined,
    relation: storage.relation,
    form,
    table:
      storage.title || storage.visible === false
        ? pruneUndefined({
            title: storage.title,
            hidden: storage.visible === false ? true : undefined,
          })
        : undefined,
    filter:
      storage.filterable === false
        ? {
            hidden: true,
          }
        : undefined,
  }) as ModelFieldSchema;
}

export function encodeModel(draft: ModelDraft): ModelSchema {
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

  const groups = draft.groups
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

  const pages =
    draft.pages.length > 0
      ? draft.pages.map(({ page }) => ({
          ...page,
          ...(["add", "edit", "detail"].includes(page.router) && groups.length > 0
            ? { groups }
            : { groups: undefined }),
        }))
      : createDefaultPages(name, title).map((page) => ({
          ...page,
          ...(["add", "edit", "detail"].includes(page.router) && groups.length > 0
            ? { groups }
            : {}),
        }));

  return parseModelSchema({
    name,
    title,
    version: draft.version,
    subtitle: draft.subtitle?.trim() || undefined,
    description: draft.description?.trim() || undefined,
    group: draft.group,
    singularLabel: draft.singularLabel?.trim() || title,
    pluralLabel: draft.pluralLabel?.trim() || title,
    defaultPageSize: draft.defaultPageSize,
    fields: draft.fields.map(encodeModelField),
    definitions: draft.definitions,
    pages,
  });
}
