import { compileExpr, type IFieldSchema, type IFormSchema } from "@alien-form/core";
import type {
  BuilderSchema,
  CompiledNode,
  CompiledPage,
  CompiledValue,
  FieldSchema,
  XPage,
} from "../protocol";

function isExpression(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("{{") && value.trim().endsWith("}}");
}

export function isCompiledValue(value: unknown): value is CompiledValue {
  return !!value && typeof value === "object" && "expression" in value;
}

function resolveRef(
  schema: FieldSchema,
  definitions: BuilderSchema["definitions"],
  stack: string[] = [],
): FieldSchema {
  if (!schema.$ref) return schema;
  const code = schema.$ref.replace(/^#\/definitions\//, "");
  if (stack.includes(code))
    throw new Error(`Circular schema reference: ${[...stack, code].join(" -> ")}`);
  const target = definitions[code];
  if (!target) throw new Error(`Schema reference not found: ${code}`);
  return resolveRef({ ...target, ...schema, $ref: undefined }, definitions, [...stack, code]);
}

function resolveField(raw: FieldSchema, definitions: BuilderSchema["definitions"]): FieldSchema {
  const referenced = resolveRef(raw, definitions);
  const schema: FieldSchema = isExpression(referenced.display)
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
  const items =
    schema.items && !Array.isArray(schema.items)
      ? resolveField(schema.items, definitions)
      : schema.items;
  return { ...schema, properties, items };
}

function compileValue(value: unknown, definitions: BuilderSchema["definitions"]): unknown {
  if (isExpression(value)) return { expression: compileExpr(value) } satisfies CompiledValue;
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
  if (isExpression(value)) {
    compileExpr(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) warmExpressions(child);
}

function compileNode(
  key: string,
  raw: FieldSchema,
  definitions: BuilderSchema["definitions"],
): CompiledNode {
  const schema = resolveField(raw, definitions);
  warmExpressions(schema);
  const children = Object.entries(schema.properties ?? {}).map(([childKey, child]) =>
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
  for (const [prop, value] of Object.entries(schema.props ?? {})) {
    if (typeof value === "string" && childMap.has(value)) slots[prop] = childMap.get(value)!;
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string" && childMap.has(item))
    ) {
      slots[prop] = value.map((item) => childMap.get(item as string)!);
    }
  }
  // 数组行模板：把 items（对象 schema）编译成一份可复用的 CompiledNode，
  // 每行子字段共用它递归渲染，从而与顶层字段走同一条渲染管线。
  const items =
    schema.items && !Array.isArray(schema.items)
      ? compileNode("$item", schema.items, definitions)
      : undefined;
  return { key, schema, props, slots, children, items };
}

export function compilePage(model: BuilderSchema, page: XPage): CompiledPage {
  const properties = Object.fromEntries(
    Object.entries(page.properties).map(([key, schema]) => [
      key,
      resolveField(schema, model.definitions),
    ]),
  );
  const pageNodes = Object.entries(properties).map(([key, schema]) =>
    compileNode(key, schema, model.definitions),
  );

  if (!page.layout) {
    return {
      router: page.router,
      title: page.title ?? model.meta.title,
      schema: { type: "object", properties: properties as Record<string, IFieldSchema> },
      nodes: pageNodes,
    };
  }

  const wrapper: FieldSchema = {
    type: "void",
    component: page.layout.component,
    props: page.layout.props,
    properties,
  };
  return {
    router: page.router,
    title: page.title ?? model.meta.title,
    schema: {
      type: "object",
      properties: { $page: wrapper as IFieldSchema },
    },
    nodes: [compileNode("$page", wrapper, model.definitions)],
  };
}

function projectGroupedProperties(schema: {
  properties: Record<string, FieldSchema>;
  group?: FieldSchema["group"];
}): Record<string, FieldSchema> {
  const groups = schema.group ?? [];
  if (groups.length === 0) return schema.properties;

  const keyToGroup = new Map<string, number>();
  groups.forEach((group, index) => {
    group.keys.forEach((key) => {
      if (schema.properties[key] && !keyToGroup.has(key)) keyToGroup.set(key, index);
    });
  });

  const emitted = new Set<number>();
  const output: Record<string, FieldSchema> = {};
  for (const [key, field] of Object.entries(schema.properties)) {
    const groupIndex = keyToGroup.get(key);
    if (groupIndex === undefined) {
      output[key] = field;
      continue;
    }
    if (emitted.has(groupIndex)) continue;
    emitted.add(groupIndex);
    const group = groups[groupIndex]!;
    output[`$group-${groupIndex}`] = {
      type: "void",
      component: group.component ?? "ObjectField",
      title: group.title,
      description: group.description,
      props: group.props,
      properties: Object.fromEntries(
        group.keys.flatMap((memberKey) => {
          const member = schema.properties[memberKey];
          return member ? [[memberKey, member]] : [];
        }),
      ),
    };
  }
  return output;
}

export function compileForm(
  schema: Pick<FieldSchema, "properties" | "group">,
  definitions: BuilderSchema["definitions"],
): { schema: IFormSchema; nodes: CompiledNode[] } {
  const projected = projectGroupedProperties({
    properties: schema.properties ?? {},
    group: schema.group,
  });
  const properties = Object.fromEntries(
    Object.entries(projected).map(([key, field]) => [key, resolveField(field, definitions)]),
  );
  return {
    schema: { type: "object", properties: properties as Record<string, IFieldSchema> },
    nodes: Object.entries(properties).map(([key, field]) => compileNode(key, field, definitions)),
  };
}

export function compileModel(model: BuilderSchema): CompiledPage[] {
  if (!model.definitions?.["form-schema"]?.properties) {
    throw new Error("definitions['form-schema'].properties is required");
  }
  return model.pages.map((page) => compilePage(model, page));
}

export function matchPage(pages: CompiledPage[], segment: string): CompiledPage | undefined {
  const normalized = segment.replace(/^\/+|\/+$/g, "") || "list";
  return pages.find((page) => page.router.replace(/^\/+|\/+$/g, "") === normalized);
}
