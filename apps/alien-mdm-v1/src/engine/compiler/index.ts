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
  const schema = resolveRef(raw, definitions);
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
  return { key, schema, props, slots, children };
}

export function compilePage(model: BuilderSchema, page: XPage): CompiledPage {
  const properties = Object.fromEntries(
    Object.entries(page.schema.properties).map(([key, schema]) => [
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

export function compileForm(
  schema: { properties: Record<string, FieldSchema> },
  definitions: BuilderSchema["definitions"],
): { schema: IFormSchema; nodes: CompiledNode[] } {
  const properties = Object.fromEntries(
    Object.entries(schema.properties).map(([key, field]) => [
      key,
      resolveField(field, definitions),
    ]),
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
  return model["x-pages"].map((page) => compilePage(model, page));
}

export function matchPage(pages: CompiledPage[], segment: string): CompiledPage | undefined {
  const normalized = segment.replace(/^\/+|\/+$/g, "") || "list";
  return pages.find((page) => page.router.replace(/^\/+|\/+$/g, "") === normalized);
}
