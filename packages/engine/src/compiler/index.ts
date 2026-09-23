import { compileExpr, type IFieldSchema, type IFormSchema } from "@alien-form/core";
import type { CompiledNode, CompiledPage, AlienFieldSchema, AlienSchema } from "../protocol";
import { createCompiledValue, isRuntimeExpression } from "./value";

export {
  compileRuntimeValue,
  containsCompiledValue,
  evaluateCompiledValue,
  isCompiledValue,
} from "./value";

type RuntimeDefinitions = Record<string, AlienFieldSchema>;

function resolveRef(
  schema: AlienFieldSchema,
  definitions: RuntimeDefinitions,
  stack: string[] = [],
): AlienFieldSchema {
  if (!schema.$ref) return schema;
  const code = schema.$ref.startsWith("#/definitions/")
    ? schema.$ref.slice("#/definitions/".length)
    : schema.$ref.replace(/^#\//, "");
  if (stack.includes(code)) {
    throw new Error(`Circular schema reference: ${[...stack, code].join(" -> ")}`);
  }
  const target = definitions[code];
  if (!target) throw new Error(`Schema reference not found: ${code}`);
  return resolveRef({ ...target, ...schema, $ref: undefined }, definitions, [...stack, code]);
}

function resolveField(raw: AlienFieldSchema, definitions: RuntimeDefinitions): AlienFieldSchema {
  const referenced = resolveRef(raw, definitions);
  const schema: AlienFieldSchema = isRuntimeExpression(referenced.display)
    ? {
        ...referenced,
        display: "visible",
        "x-reaction": { ...referenced["x-reaction"], display: referenced.display },
      }
    : referenced;
  const properties = schema.properties
    ? Object.fromEntries(
        Object.entries(schema.properties).map(([key, child]) => [
          key,
          resolveField(child, definitions),
        ]),
      )
    : undefined;
  const slots = schema.slots
    ? Object.fromEntries(
        Object.entries(schema.slots).map(([name, nodes]) => [
          name,
          Object.fromEntries(
            Object.entries(nodes).map(([key, child]) => [key, resolveField(child, definitions)]),
          ),
        ]),
      )
    : undefined;
  const items =
    schema.items && !Array.isArray(schema.items)
      ? resolveField(schema.items, definitions)
      : schema.items;
  return { ...schema, properties, slots, items };
}

function compileValue(value: unknown, definitions: RuntimeDefinitions): unknown {
  if (isRuntimeExpression(value)) return createCompiledValue(value);
  if (Array.isArray(value)) return value.map((item) => compileValue(item, definitions));
  if (!value || typeof value !== "object") return value;
  if ("$ref" in value && typeof value.$ref === "string") {
    return resolveField({ $ref: value.$ref }, definitions);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, compileValue(child, definitions)]),
  );
}

function warmExpressions(value: unknown): void {
  if (isRuntimeExpression(value)) {
    compileExpr(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) warmExpressions(child);
}

function compileNode(
  key: string,
  raw: AlienFieldSchema,
  definitions: RuntimeDefinitions,
): CompiledNode {
  const schema = resolveField(raw, definitions);
  warmExpressions(schema);
  const childEntries = [
    ...Object.entries(schema.properties ?? {}),
    ...Object.values(schema.slots ?? {}).flatMap((nodes) => Object.entries(nodes)),
  ];
  const children = childEntries.map(([childKey, child]) =>
    compileNode(childKey, child, definitions),
  );
  const childMap = new Map(children.map((child) => [child.key, child]));
  const props = Object.fromEntries(
    Object.entries(schema.props ?? {}).map(([prop, value]) => [
      prop,
      compileValue(value, definitions),
    ]),
  );
  const slots: CompiledNode["slots"] = {};
  for (const [name, slotNodes] of Object.entries(schema.slots ?? {})) {
    const nodes = Object.keys(slotNodes).map((childKey) => childMap.get(childKey)!);
    slots[name] = nodes.length === 1 ? nodes[0]! : nodes;
  }
  const items =
    schema.items && !Array.isArray(schema.items)
      ? compileNode("$item", schema.items, definitions)
      : undefined;
  return { key, schema, props, slots, children, items };
}

function relationForm(field: AlienSchema["fields"][number]): AlienFieldSchema {
  const form = { ...field.form, props: { ...field.form.props } };
  if (!field.relation) return form;
  const component = form.component === "TreeSelect" ? "TreeSelect" : "RemoteSelect";
  const props = {
    ...form.props,
    model: field.relation.target,
    valueField: field.relation.valueField ?? "id",
    labelField: field.relation.labelField ?? "name",
    ...(component === "TreeSelect"
      ? {
          parentField: field.key,
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        }
      : {
          loadOptions: '{{ $utils.relation($service("records.list")) }}',
          pageSize: form.props?.pageSize ?? 10,
          ...(field.relation.kind === "many-to-many" ? { multiple: true } : {}),
        }),
  };
  return { ...form, component, props };
}

function fieldDefinition(field: AlienSchema["fields"][number]): AlienFieldSchema {
  return {
    ...relationForm(field),
    type: field.type,
    title: field.title,
    required: field.required || undefined,
  };
}

export function buildFormSchema(model: AlienSchema): AlienFieldSchema {
  return resolveField(model.form, buildRuntimeDefinitions(model));
}

export function buildRuntimeDefinitions(model: AlienSchema): RuntimeDefinitions {
  const fieldDefinitions = Object.fromEntries(
    model.fields.map((field) => [`fields/${field.key}`, fieldDefinition(field)]),
  );
  return {
    ...model.definitions,
    ...fieldDefinitions,
    "form-schema": model.form,
  };
}

export function compilePage(model: AlienSchema, page: AlienSchema["pages"][number]): CompiledPage {
  const definitions = buildRuntimeDefinitions(model);
  const root = resolveField(page, definitions);
  const materialized = materializeNode(root);
  return {
    router: page.router,
    title: page.title ?? model.title,
    schema: {
      type: "object",
      component: root.component,
      props: root.props,
      properties: materialized.properties as Record<string, IFieldSchema>,
    },
    root: compileNode("$root", root, definitions),
  };
}

function materializeNode(schema: AlienFieldSchema): AlienFieldSchema {
  const children = [
    ...Object.entries(schema.properties ?? {}),
    ...Object.values(schema.slots ?? {}).flatMap((nodes) => Object.entries(nodes)),
  ];
  return {
    ...schema,
    properties:
      children.length > 0
        ? Object.fromEntries(children.map(([key, child]) => [key, materializeNode(child)]))
        : undefined,
  };
}

export function compileForm(
  schema: Pick<AlienFieldSchema, "properties">,
  definitions: RuntimeDefinitions = {},
): { schema: IFormSchema; nodes: CompiledNode[] } {
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, field]) => [
      key,
      resolveField(field, definitions),
    ]),
  );
  return {
    schema: { type: "object", properties: properties as Record<string, IFieldSchema> },
    nodes: Object.entries(properties).map(([key, field]) => compileNode(key, field, definitions)),
  };
}

export function compileModel(model: AlienSchema): CompiledPage[] {
  return model.pages.map((page) => compilePage(model, page));
}

export function matchPage(pages: CompiledPage[], segment: string): CompiledPage | undefined {
  const normalized = segment.replace(/^\/+|\/+$/g, "") || "list";
  return pages.find((page) => page.router.replace(/^\/+|\/+$/g, "") === normalized);
}
