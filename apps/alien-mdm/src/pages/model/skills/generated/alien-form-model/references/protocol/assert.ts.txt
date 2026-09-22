import { parse, type Node } from "acorn";
import {
  modelSchemaSchema,
  pageSchema,
  type DatabaseValueType,
  type ModelFieldSchema,
  type ModelSchema,
  type PageSchema,
} from "./model-schema.ts";
import type FieldSchema from "./field-schema.ts";
import {
  COMPONENT_CAPABILITIES,
  ENUM_CAPABILITIES,
  SERVICE_CAPABILITIES,
  UTILITY_CAPABILITIES,
  type ComponentCapability,
  type PropertyType,
} from "./capabilities.ts";

const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
const componentCapabilities = new Map<string, ComponentCapability>(
  COMPONENT_CAPABILITIES.map((capability) => [capability.code, capability]),
);
const serviceCodes = new Set<string>(SERVICE_CAPABILITIES.map(({ code }) => code));
const utilityCodes = new Set<string>(UTILITY_CAPABILITIES.map(({ code }) => code));
const enumCodes = new Set<string>(ENUM_CAPABILITIES.map(({ code }) => code));

type AstNode = Node & Record<string, unknown>;

function isExpression(value: unknown): value is string {
  return typeof value === "string" && /^\s*\{\{[\s\S]*\}\}\s*$/.test(value);
}

function expressionSource(value: string): string {
  const trimmed = value.trim();
  return trimmed.slice(2, -2).trim();
}

function walkAst(
  node: AstNode,
  visit: (node: AstNode, parent?: AstNode, key?: string) => void,
  parent?: AstNode,
  key?: string,
): void {
  visit(node, parent, key);
  for (const [childKey, value] of Object.entries(node)) {
    if (childKey === "start" || childKey === "end" || childKey === "loc") continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object" && typeof child.type === "string") {
          walkAst(child as AstNode, visit, node, childKey);
        }
      }
    } else if (value && typeof value === "object" && typeof (value as AstNode).type === "string") {
      walkAst(value as AstNode, visit, node, childKey);
    }
  }
}

function memberCode(node: AstNode, namespace: "$utils" | "$enums"): string | undefined {
  if (node.type !== "MemberExpression") return undefined;
  const object = node.object as AstNode | undefined;
  if (object?.type !== "Identifier" || object.name !== namespace) return undefined;
  const property = node.property as AstNode | undefined;
  if (node.computed === false && property?.type === "Identifier") return String(property.name);
  if (
    node.computed === true &&
    property?.type === "Literal" &&
    typeof property.value === "string"
  ) {
    return property.value;
  }
  throw new Error(`${namespace} 只允许使用静态能力名称`);
}

function assertExpression(value: string, path: string, rowScope: boolean): void {
  const source = expressionSource(value);
  let root: AstNode;
  try {
    root = parse(`(${source})`, {
      ecmaVersion: "latest",
      sourceType: "script",
    }) as unknown as AstNode;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`${path} 表达式语法不合法：${message}`);
  }

  try {
    walkAst(root, (node, parent, key) => {
      if (
        node.type === "Identifier" &&
        node.name === "$row" &&
        !rowScope &&
        !(
          (parent?.type === "MemberExpression" &&
            key === "property" &&
            parent.computed === false) ||
          (parent?.type === "Property" && key === "key" && parent.computed === false)
        )
      ) {
        throw new Error("$row 仅允许在数组项或 rowActions slot 中使用");
      }
      if (node.type === "CallExpression") {
        const callee = node.callee as AstNode | undefined;
        if (callee?.type === "Identifier" && callee.name === "$service") {
          const args = node.arguments as AstNode[];
          const first = args[0];
          if (args.length !== 1 || first?.type !== "Literal" || typeof first.value !== "string") {
            throw new Error("$service 只允许使用一个静态字符串能力名称");
          }
          if (!serviceCodes.has(first.value)) {
            throw new Error(`服务能力不存在：${first.value}`);
          }
        }
      }
      const utility = memberCode(node, "$utils");
      if (utility && !utilityCodes.has(utility)) {
        throw new Error(`工具能力不存在：${utility}`);
      }
      const enumCode = memberCode(node, "$enums");
      if (enumCode && !enumCodes.has(enumCode)) {
        throw new Error(`枚举能力不存在：${enumCode}`);
      }
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`${path} 表达式引用不合法：${message}`);
  }
}

function assertExpressions(value: unknown, path: string, rowScope: boolean): void {
  if (isExpression(value)) {
    assertExpression(value, path, rowScope);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertExpressions(item, `${path}.${index}`, rowScope));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertExpressions(child, `${path}.${key}`, rowScope);
  }
}

function matchesType(value: unknown, type: PropertyType): boolean {
  if (type === "node") return true;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

function assertComponent(code: string, path: string): ComponentCapability {
  const capability = componentCapabilities.get(code);
  if (!capability) throw new Error(`${path} 引用了未声明的组件能力：${code}`);
  return capability;
}

function assertProps(schema: FieldSchema, capability: ComponentCapability, path: string): void {
  const props = schema.props ?? {};
  for (const [name, contract] of Object.entries(capability.meta?.props ?? {})) {
    const value = props[name];
    if (contract.required && value === undefined) {
      throw new Error(`${path}.props.${name} 必填`);
    }
    if (value === undefined || isExpression(value)) continue;
    const types = Array.isArray(contract.type) ? contract.type : [contract.type];
    if (!types.some((type) => matchesType(value, type))) {
      throw new Error(`${path}.props.${name} 类型必须为 ${types.join(" | ")}`);
    }
  }
}

function assertComponentType(
  schema: FieldSchema,
  capability: ComponentCapability,
  path: string,
): void {
  const types = capability.meta?.types;
  if (schema.type && types && !types.includes(schema.type)) {
    throw new Error(`${path}.component ${capability.code} 不支持 ${schema.type} 类型`);
  }
  if (
    capability.meta?.kind === "complex" &&
    schema.type === "array" &&
    (!schema.items || Array.isArray(schema.items))
  ) {
    throw new Error(`${path}.component ${capability.code} 仅支持包含 items 的复杂数组`);
  }
}

function assertSlots(
  schema: FieldSchema,
  capability: ComponentCapability,
  path: string,
): Map<string, boolean> {
  const contracts = capability.meta?.slots ?? {};
  const properties = schema.properties ?? {};
  const used = new Set<string>();
  const rowScope = new Map<string, boolean>();
  for (const [name, contract] of Object.entries(contracts)) {
    if (contract.required && schema.slots?.[name] === undefined) {
      throw new Error(`${path}.slots.${name} 必填`);
    }
  }
  for (const [name, reference] of Object.entries(schema.slots ?? {})) {
    const contract = contracts[name];
    if (!contract) throw new Error(`${path}.slots.${name} 不是组件 ${capability.code} 的有效 slot`);
    if (Array.isArray(reference) && !contract.multiple) {
      throw new Error(`${path}.slots.${name} 只允许引用一个节点`);
    }
    const keys = Array.isArray(reference) ? reference : [reference];
    for (const key of keys) {
      if (!properties[key]) throw new Error(`${path}.slots.${name} 引用了不存在的节点：${key}`);
      if (used.has(key)) throw new Error(`${path}.slots 中重复引用节点：${key}`);
      used.add(key);
      rowScope.set(key, contract.scope?.includes("$row") ?? false);
    }
  }
  return rowScope;
}

function assertFieldNode(schema: FieldSchema, path: string, rowScope = false): void {
  let capability: ComponentCapability | undefined;
  if (schema.component) {
    capability = assertComponent(schema.component, `${path}.component`);
    assertComponentType(schema, capability, path);
    assertProps(schema, capability, path);
  }
  if (schema.decorator) {
    assertComponent(schema.decorator, `${path}.decorator`);
  }
  if (schema["x-layout"]) {
    assertComponent(schema["x-layout"], `${path}.x-layout`);
  }
  const slotScopes = capability
    ? assertSlots(schema, capability, path)
    : new Map<string, boolean>();
  const { properties: _properties, items: _items, ...ownSchema } = schema;
  assertExpressions(ownSchema, path, rowScope);
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    assertFieldNode(child, `${path}.properties.${key}`, rowScope || !!slotScopes.get(key));
  }
  if (schema.items && !Array.isArray(schema.items)) {
    assertFieldNode(schema.items, `${path}.items`, true);
  }
}

function assertPageSemantics(page: PageSchema, path: string): void {
  if (page.layout) {
    const layoutSchema: FieldSchema = {
      component: page.layout.component,
      props: page.layout.props,
      slots: page.layout.slots,
      properties: page.properties,
    };
    assertFieldNode(layoutSchema, `${path}.layout`);
    return;
  }
  for (const [key, node] of Object.entries(page.properties)) {
    assertFieldNode(node, `${path}.properties.${key}`);
  }
}

function fieldValueType(field: ModelFieldSchema): DatabaseValueType {
  const database = field.database;
  if (!database) {
    if (field.form.type === "number") return "number";
    if (field.form.type === "boolean") return "boolean";
    if (field.form.type === "object") return "object";
    if (field.form.type === "array") return "array";
    return "string";
  }
  if (database.valueType) return database.valueType;
  if (database.type === "integer" || database.type === "real") return "number";
  if (database.type === "boolean") return "boolean";
  if (database.type === "json") return "object";
  return "string";
}

function formatValue(value: unknown): string {
  return value === undefined ? "未配置" : JSON.stringify(value);
}

function assertRelationForm(field: ModelFieldSchema, modelName: string): void {
  const relation = field.relation;
  if (!relation) return;
  const path = `fields.${field.key}.form`;
  const expectedValueField = relation.valueField ?? "id";
  const expectedLabelField = relation.labelField ?? "name";
  const props = field.form.props;

  if (field.form.component !== "RemoteSelect" && field.form.component !== "TreeSelect") {
    throw new Error(`${path}.component 必须为 "RemoteSelect" 或 "TreeSelect"`);
  }
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    throw new Error(`${path}.props 必须包含关联配置`);
  }
  if (props.model !== relation.target) {
    throw new Error(
      `${path}.props.model 必须为 ${JSON.stringify(relation.target)}，实际 ${formatValue(props.model)}`,
    );
  }
  if (props.valueField !== expectedValueField) {
    throw new Error(
      `${path}.props.valueField 必须为 ${JSON.stringify(expectedValueField)}，实际 ${formatValue(props.valueField)}`,
    );
  }
  if (props.labelField !== expectedLabelField) {
    throw new Error(
      `${path}.props.labelField 必须为 ${JSON.stringify(expectedLabelField)}，实际 ${formatValue(props.labelField)}`,
    );
  }
  if (field.form.component === "TreeSelect") {
    if (relation.target !== modelName) {
      throw new Error(`${path}.component 仅自关联字段可使用 "TreeSelect"`);
    }
    if (props.parentField !== field.key) {
      throw new Error(
        `${path}.props.parentField 必须为 ${JSON.stringify(field.key)}，实际 ${formatValue(props.parentField)}`,
      );
    }
  }
}

function assertPageGroups(schema: ModelSchema): void {
  const fieldKeys = new Set(schema.fields.map((field) => field.key));
  for (const page of schema.pages) {
    const assigned = new Set<string>();
    for (const group of page.groups ?? []) {
      for (const key of group.keys) {
        if (!fieldKeys.has(key)) {
          throw new Error(`页面 ${page.router} 的 groups 引用了不存在的字段：${key}`);
        }
        if (assigned.has(key)) {
          throw new Error(`页面 ${page.router} 的 groups 字段重复：${key}`);
        }
        assigned.add(key);
      }
    }
  }
}

function assertPages(schema: ModelSchema): void {
  const routes = new Set<string>();
  schema.pages.forEach((page, index) => {
    if (routes.has(page.router)) throw new Error(`页面 router 重复：${page.router}`);
    routes.add(page.router);
    assertPageSemantics(page, `pages.${index}`);
  });
}

function assertDefinitions(schema: ModelSchema): void {
  if (schema.definitions?.["form-schema"]) {
    throw new Error('definitions 不允许声明 "form-schema"，该定义由前端运行时派生');
  }
  for (const [key, definition] of Object.entries(schema.definitions ?? {})) {
    assertFieldNode(definition, `definitions.${key}`);
  }
}

export function assertModelSchema(value: unknown): asserts value is ModelSchema {
  const parsed = modelSchemaSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`模型定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const schema = parsed.data as ModelSchema;
  const ids = new Set<string>();
  const keys = new Set<string>();

  for (const field of schema.fields) {
    if (ids.has(field.id)) throw new Error(`字段 id 重复：${field.id}`);
    if (keys.has(field.key)) throw new Error(`字段 key 重复：${field.key}`);
    ids.add(field.id);
    keys.add(field.key);

    if (field.storage === "physical" && !field.database) {
      throw new Error(`physical 字段 ${field.key} 必须配置 database`);
    }
    if (field.storage === "virtual" && field.database) {
      throw new Error(`virtual 字段 ${field.key} 不允许配置 database`);
    }
    if (
      field.database &&
      field.database.type !== "json" &&
      (field.database.valueType === "object" || field.database.valueType === "array")
    ) {
      throw new Error(`字段 ${field.key} 只有 json 物理类型可使用 object/array valueType`);
    }
    if (field.storage === "physical" && field.form.type !== fieldValueType(field)) {
      throw new Error(`字段 ${field.key} 的 form.type 与 database 类型不一致`);
    }
    if (
      field.storage === "physical" &&
      field.database?.system !== true &&
      Boolean(field.form.required) !== (field.database?.nullable === false)
    ) {
      throw new Error(`字段 ${field.key} 的 form.required 与 database.nullable 不一致`);
    }
    assertRelationForm(field, schema.name);
    assertFieldNode(field.form, `fields.${field.key}.form`);
  }

  for (const key of SYSTEM_FIELDS) {
    const field = schema.fields.find((item) => item.key === key);
    if (!field || field.storage !== "physical" || field.database?.system !== true) {
      throw new Error(`系统字段 ${key} 必须声明为 physical 且 database.system=true`);
    }
  }

  assertDefinitions(schema);
  assertPageGroups(schema);
  assertPages(schema);
}

export function parsePageSchema(value: unknown): PageSchema {
  const result = pageSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`页面定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const page = result.data as PageSchema;
  assertPageSemantics(page, "page");
  return page;
}

export function parseModelSchema(value: unknown): ModelSchema {
  const parsed = modelSchemaSchema.parse(value) as ModelSchema;
  assertModelSchema(parsed);
  return parsed;
}

export function isModelSchema(value: unknown): value is ModelSchema {
  try {
    assertModelSchema(value);
    return true;
  } catch {
    return false;
  }
}

export function modelFormProperties(schema: ModelSchema): Record<string, FieldSchema> {
  return Object.fromEntries(schema.fields.map((field) => [field.key, field.form]));
}

export function physicalFields(schema: ModelSchema): ModelFieldSchema[] {
  return schema.fields.filter((field) => field.storage === "physical");
}

export function valueType(field: ModelFieldSchema): DatabaseValueType {
  return fieldValueType(field);
}

/** Allows a scalar relation to move into a preserved many-to-many relation table. */
function isManyToManyMigration(current: ModelFieldSchema, incoming: ModelFieldSchema): boolean {
  const before = current.relation;
  const after = incoming.relation;
  return (
    before?.kind === "many-to-one" &&
    after?.kind === "many-to-many" &&
    before.target === after.target &&
    (before.valueField ?? "id") === (after.valueField ?? "id") &&
    (before.labelField ?? "name") === (after.labelField ?? "name") &&
    current.database?.type === "text" &&
    incoming.database?.type === "json" &&
    incoming.database.valueType === "array" &&
    current.form.type === "string" &&
    incoming.form.type === "array"
  );
}

export function assertStorageCompatible(current: ModelSchema, incoming: ModelSchema): void {
  if (current.name !== incoming.name) throw new Error("模型 name 不允许修改");
  const incomingById = new Map(incoming.fields.map((field) => [field.id, field]));

  for (const field of current.fields) {
    if (field.storage !== "physical") continue;
    const next = incomingById.get(field.id);
    if (!next) throw new Error(`物理字段不允许删除：${field.key}`);
    if (next.storage !== "physical") throw new Error(`物理字段不允许转为 virtual：${field.key}`);
    if (next.key !== field.key) throw new Error(`物理字段 key 不允许修改：${field.key}`);
    const relationMigration = isManyToManyMigration(field, next);
    if (next.database?.column !== field.database?.column) {
      throw new Error(`物理字段 column 不允许修改：${field.key}`);
    }
    if (!relationMigration && next.database?.type !== field.database?.type) {
      throw new Error(`物理字段类型不允许修改：${field.key}`);
    }
    if (!relationMigration && next.database?.valueType !== field.database?.valueType) {
      throw new Error(`物理字段 valueType 不允许修改：${field.key}`);
    }
    if (next.database?.nullable !== field.database?.nullable) {
      throw new Error(`物理字段 nullable 不允许修改：${field.key}`);
    }
    if (next.database?.default !== field.database?.default) {
      throw new Error(`物理字段 default 不允许修改：${field.key}`);
    }
    if (!relationMigration && JSON.stringify(next.relation) !== JSON.stringify(field.relation)) {
      throw new Error(`物理字段 relation 不允许修改：${field.key}`);
    }
    if (field.database?.index && !next.database?.index) {
      throw new Error(`物理字段索引不允许移除：${field.key}`);
    }
    if (field.database?.unique && !next.database?.unique) {
      throw new Error(`物理字段唯一索引不允许移除：${field.key}`);
    }
  }
}
