import { parse, type Node } from "acorn";
import {
  alienSchema,
  alienPageSchema,
  type AlienFieldSchema,
  type AlienSchema,
  type AlienValue,
} from "./alien-schema.ts";
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

function assertProps(
  schema: AlienFieldSchema,
  capability: ComponentCapability,
  path: string,
): void {
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
  schema: AlienFieldSchema,
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
  schema: AlienFieldSchema,
  capability: ComponentCapability,
  path: string,
): void {
  const contracts = capability.meta?.slots ?? {};
  const used = new Set<string>();
  for (const [name, contract] of Object.entries(contracts)) {
    if (contract.required && schema.slots?.[name] === undefined) {
      throw new Error(`${path}.slots.${name} 必填`);
    }
  }
  for (const [name, nodes] of Object.entries(schema.slots ?? {})) {
    const contract = contracts[name];
    if (!contract) throw new Error(`${path}.slots.${name} 不是组件 ${capability.code} 的有效 slot`);
    const entries = Object.entries(nodes);
    if (entries.length > 1 && !contract.multiple) {
      throw new Error(`${path}.slots.${name} 只允许一个节点`);
    }
    for (const [key, child] of entries) {
      if (used.has(key)) throw new Error(`${path}.slots 中重复引用节点：${key}`);
      used.add(key);
      assertFieldNode(child, `${path}.slots.${name}.${key}`, contract.scope?.includes("$row"));
    }
  }
}

function assertFieldNode(schema: AlienFieldSchema, path: string, rowScope = false): void {
  let capability: ComponentCapability | undefined;
  if (schema.component) {
    capability = assertComponent(schema.component, `${path}.component`);
    assertComponentType(schema, capability, path);
    assertProps(schema, capability, path);
  }
  if (schema.decorator) {
    assertComponent(schema.decorator, `${path}.decorator`);
  }
  if (capability) {
    assertSlots(schema, capability, path);
  } else if (schema.slots) {
    throw new Error(`${path}.slots 需要声明 component`);
  }
  const { properties: _properties, items: _items, slots: _slots, ...ownSchema } = schema;
  assertExpressions(ownSchema, path, rowScope);
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    assertFieldNode(child, `${path}.properties.${key}`, rowScope);
  }
  if (schema.items && !Array.isArray(schema.items)) {
    assertFieldNode(schema.items, `${path}.items`, true);
  }
}

function assertPageSemantics(page: AlienSchema["pages"][number], path: string): void {
  assertFieldNode(page, path);
}

function fieldValueType(
  field: AlienSchema["fields"][number],
): Exclude<AlienSchema["fields"][number]["type"], "void"> {
  return field.type === "void" ? "string" : field.type;
}

function assertRelationForm(field: AlienSchema["fields"][number], modelName: string): void {
  const relation = field.relation;
  if (!relation) return;
  const path = `fields.${field.key}.form`;

  if (
    field.form.component &&
    field.form.component !== "RemoteSelect" &&
    field.form.component !== "TreeSelect"
  ) {
    throw new Error(`${path}.component 必须为 "RemoteSelect" 或 "TreeSelect"`);
  }
  const derivedProps = [
    "model",
    "valueField",
    "labelField",
    "loadOptions",
    "loadData",
    "multiple",
    "parentField",
  ];
  for (const key of derivedProps) {
    if (field.form.props?.[key] !== undefined) {
      throw new Error(`${path}.props.${key} 由 relation 派生，不允许重复声明`);
    }
  }
  if (field.form.component === "TreeSelect") {
    if (relation.target !== modelName) {
      throw new Error(`${path}.component 仅自关联字段可使用 "TreeSelect"`);
    }
  }
}

function runtimeAlienFieldSchema(field: AlienSchema["fields"][number]): AlienFieldSchema {
  const component =
    field.relation && field.form.component !== "TreeSelect" ? "RemoteSelect" : field.form.component;
  const relationProps: Record<string, AlienValue> = field.relation
    ? component === "TreeSelect"
      ? {
          model: field.relation.target,
          valueField: field.relation.valueField ?? "id",
          labelField: field.relation.labelField ?? "name",
          parentField: field.key,
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        }
      : {
          model: field.relation.target,
          valueField: field.relation.valueField ?? "id",
          labelField: field.relation.labelField ?? "name",
          loadOptions: '{{ $utils.relation($service("records.list")) }}',
          pageSize: 10,
          ...(field.relation.kind === "many-to-many" ? { multiple: true } : {}),
        }
    : {};
  return {
    ...field.form,
    type: field.type,
    title: field.title,
    required: field.required || undefined,
    component,
    props: { ...field.form.props, ...relationProps },
  };
}

function assertPages(schema: AlienSchema): void {
  const routes = new Set<string>();
  schema.pages.forEach((page, index) => {
    if (routes.has(page.router)) throw new Error(`页面 router 重复：${page.router}`);
    routes.add(page.router);
    assertPageSemantics(page, `pages.${index}`);
  });
}

function assertDefinitions(schema: AlienSchema): void {
  for (const [key, definition] of Object.entries(schema.definitions ?? {})) {
    assertFieldNode(definition, `definitions.${key}`);
  }
}

export function assertAlienSchema(value: unknown): asserts value is AlienSchema {
  const parsed = alienSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`模型定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const schema = parsed.data as AlienSchema;
  const ids = new Set<string>();
  const keys = new Set<string>();

  for (const field of schema.fields) {
    if (ids.has(field.id)) throw new Error(`字段 id 重复：${field.id}`);
    if (keys.has(field.key)) throw new Error(`字段 key 重复：${field.key}`);
    ids.add(field.id);
    keys.add(field.key);

    if (
      field.storage &&
      field.storage.type !== "json" &&
      (field.type === "object" || field.type === "array")
    ) {
      throw new Error(`字段 ${field.key} 只有 json 物理类型可使用 object/array`);
    }
    if (field.form.type || field.form.title || field.form.required !== undefined) {
      throw new Error(`字段 ${field.key} 的 type/title/required 只能声明在字段根部`);
    }
    assertRelationForm(field, schema.name);
    assertFieldNode(runtimeAlienFieldSchema(field), `fields.${field.key}.form`);
  }

  for (const key of SYSTEM_FIELDS) {
    const field = schema.fields.find((item) => item.key === key);
    if (!field?.storage || field.storage.system !== true) {
      throw new Error(`系统字段 ${key} 必须声明 storage.system=true`);
    }
  }

  assertDefinitions(schema);
  assertFieldNode(schema.form, "form");
  assertPages(schema);
}

export function parseAlienPage(value: unknown): AlienSchema["pages"][number] {
  const result = alienPageSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`页面定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const page = result.data;
  assertPageSemantics(page, "page");
  return page;
}

export function parseAlienSchema(value: unknown): AlienSchema {
  const parsed = alienSchema.parse(value) as AlienSchema;
  assertAlienSchema(parsed);
  return parsed;
}

export function isAlienSchema(value: unknown): value is AlienSchema {
  try {
    assertAlienSchema(value);
    return true;
  } catch {
    return false;
  }
}

export function modelFormProperties(schema: AlienSchema): Record<string, AlienFieldSchema> {
  return Object.fromEntries(
    schema.fields.map((field) => [
      field.key,
      {
        ...field.form,
        type: field.type,
        title: field.title,
        required: field.required || undefined,
      },
    ]),
  );
}

export function physicalFields(schema: AlienSchema): AlienSchema["fields"] {
  return schema.fields.filter((field) => field.storage !== undefined);
}

export function valueType(
  field: AlienSchema["fields"][number],
): Exclude<AlienSchema["fields"][number]["type"], "void"> {
  return fieldValueType(field);
}

/** Allows a scalar relation to move into a preserved many-to-many relation table. */
function isManyToManyMigration(
  current: AlienSchema["fields"][number],
  incoming: AlienSchema["fields"][number],
): boolean {
  const before = current.relation;
  const after = incoming.relation;
  return (
    before?.kind === "many-to-one" &&
    after?.kind === "many-to-many" &&
    before.target === after.target &&
    (before.valueField ?? "id") === (after.valueField ?? "id") &&
    (before.labelField ?? "name") === (after.labelField ?? "name") &&
    current.storage?.type === "text" &&
    incoming.storage?.type === "json" &&
    current.type === "string" &&
    incoming.type === "array"
  );
}

export function assertStorageCompatible(current: AlienSchema, incoming: AlienSchema): void {
  if (current.name !== incoming.name) throw new Error("模型 name 不允许修改");
  const incomingById = new Map(incoming.fields.map((field) => [field.id, field]));

  for (const field of current.fields) {
    if (!field.storage) continue;
    const next = incomingById.get(field.id);
    if (!next) throw new Error(`物理字段不允许删除：${field.key}`);
    if (!next.storage) throw new Error(`物理字段不允许转为 virtual：${field.key}`);
    if (next.key !== field.key) throw new Error(`物理字段 key 不允许修改：${field.key}`);
    const relationMigration = isManyToManyMigration(field, next);
    if (next.storage.column !== field.storage.column) {
      throw new Error(`物理字段 column 不允许修改：${field.key}`);
    }
    if (!relationMigration && next.storage.type !== field.storage.type) {
      throw new Error(`物理字段类型不允许修改：${field.key}`);
    }
    if (!relationMigration && next.type !== field.type) {
      throw new Error(`物理字段 type 不允许修改：${field.key}`);
    }
    if (next.required !== field.required) {
      throw new Error(`物理字段 required 不允许修改：${field.key}`);
    }
    if (next.storage.default !== field.storage.default) {
      throw new Error(`物理字段 default 不允许修改：${field.key}`);
    }
    if (!relationMigration && JSON.stringify(next.relation) !== JSON.stringify(field.relation)) {
      throw new Error(`物理字段 relation 不允许修改：${field.key}`);
    }
    if (field.storage.index && !next.storage.index) {
      throw new Error(`物理字段索引不允许移除：${field.key}`);
    }
    if (field.storage.unique && !next.storage.unique) {
      throw new Error(`物理字段唯一索引不允许移除：${field.key}`);
    }
  }
}
