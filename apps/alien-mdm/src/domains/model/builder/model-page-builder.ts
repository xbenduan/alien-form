import type { IFieldSchema, IFormSchema } from "@alien-form/core";
import type { PageSchema, UiNode } from "@alien-form/engine";
import { getFieldDefinition } from "../../../register/global/form/registry";
import type { GroupConfig, TableColumn } from "../../../types/shared";
import type {
  Locale,
  ModelFieldSchema,
  ModelPageScene,
  ModelSchema,
  ProjectionContext,
} from "./types";

function sortedEntries(
  properties: Record<string, ModelFieldSchema>,
): Array<[string, ModelFieldSchema]> {
  return Object.entries(properties).sort(([, left], [, right]) => {
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

function context(
  scene: ProjectionContext["scene"],
  locale: Locale,
  domain: string,
): ProjectionContext {
  const projectionContext: ProjectionContext = {
    scene,
    locale,
    projectProperties(properties) {
      return Object.fromEntries(
        sortedEntries(properties).map(([key, field]) => [
          key,
          definition(field, domain).projection.toForm(field, projectionContext),
        ]),
      );
    },
  };
  return projectionContext;
}

function definition(field: ModelFieldSchema, domain: string) {
  const resolved =
    getFieldDefinition(field.component, domain) ?? getFieldDefinition("Input", domain);
  if (!resolved) throw new Error(`[alien-mdm] field definition "${field.component}" not found`);
  return resolved;
}

export function projectForm(schema: ModelSchema, locale: Locale = "zh"): IFormSchema {
  const domain = schema.meta.name;
  const ctx = context("form", locale, domain);
  const properties = schema.properties ?? {};
  const groups = schema.group ?? [];
  const keyToGroup = new Map<string, number>();
  groups.forEach((group, index) => group.keys.forEach((key) => keyToGroup.set(key, index)));
  const emittedGroups = new Set<number>();
  const output: Record<string, IFieldSchema> = {};

  sortedEntries(properties).forEach(([key, field], index) => {
    const groupIndex = keyToGroup.get(key);
    if (groupIndex === undefined) {
      output[key] = {
        ...definition(field, domain).projection.toForm(field, ctx),
        order: field.order ?? index,
      };
      return;
    }
    if (emittedGroups.has(groupIndex)) return;
    emittedGroups.add(groupIndex);
    const group = groups[groupIndex] as GroupConfig;
    output[`group-${groupIndex}`] = {
      "x-layout": group.component,
      type: "void",
      title: group.title,
      props: group.props,
      order: field.order ?? index,
      properties: Object.fromEntries(
        group.keys.flatMap((memberKey, memberIndex) => {
          const member = properties[memberKey];
          return member
            ? [
                [
                  memberKey,
                  {
                    ...definition(member, domain).projection.toForm(member, ctx),
                    order: memberIndex,
                  },
                ],
              ]
            : [];
        }),
      ),
    };
  });
  return {
    type: "object",
    title: schema.title,
    description: schema.description,
    properties: output,
  };
}

export function projectFilter(schema: ModelSchema, locale: Locale = "zh"): IFormSchema {
  const domain = schema.meta.name;
  const ctx = context("filter", locale, domain);
  const properties: Record<string, IFieldSchema> = {};
  const walk = (fields?: Record<string, ModelFieldSchema>) => {
    for (const [key, field] of Object.entries(fields ?? {})) {
      const childProperties =
        field.properties ??
        (field.items && !Array.isArray(field.items) ? field.items.properties : undefined);
      if (childProperties) {
        walk(childProperties);
        continue;
      }
      if (field.display === "none") continue;
      const filterable = field["x-database"]?.filterable ?? field["x-database"]?.index ?? false;
      if (!filterable) continue;
      const projected = definition(field, domain).projection.toFilter(field, key, ctx);
      if (projected) properties[key] = projected;
    }
  };
  walk(schema.properties);
  return { type: "object", properties };
}

export function projectColumns(schema: ModelSchema, locale: Locale = "zh"): TableColumn[] {
  const domain = schema.meta.name;
  const ctx = context("table", locale, domain);
  return sortedEntries(schema.properties)
    .filter(([, field]) => field.display !== "none")
    .filter(([, field]) => field["x-table"]?.visible !== false)
    .map(([key, field]) => definition(field, domain).projection.toColumn(field, key, ctx));
}

function injectListNode(node: UiNode, columns: TableColumn[], model: string): UiNode {
  let next = structuredClone(node);
  if (next.component === "table") {
    next.props = { ...next.props, columns, model };
  } else if (next.component === "filter") {
    next.block = "filter";
    next.props = { ...next.props, listBlock: "main" };
  }
  if (next.children) next.children = next.children.map((child) => injectListNode(child, columns, model));
  if (next.slots) {
    next.slots = Object.fromEntries(
      Object.entries(next.slots).map(([name, children]) => [
        name,
        children.map((child) => injectListNode(child, columns, model)),
      ]),
    );
  }
  return next;
}

function pageMeta(schema: ModelSchema, scene: ModelPageScene): Record<string, unknown> {
  return {
    model: schema.meta.name,
    title: schema.meta.title,
    singularLabel: schema.meta.singularLabel,
    openMode: schema.meta.openMode,
    scene,
    mode: scene === "list" ? "edit" : scene,
  };
}

export function buildModelPage({
  schema,
  scene,
  recordId,
  locale = "zh",
}: {
  schema: ModelSchema;
  scene: ModelPageScene;
  recordId?: string;
  locale?: Locale;
}): PageSchema {
  const model = schema.meta.name;
  const formSchema = projectForm(schema, locale);
  const resources = {
    i18n: schema.i18n as Record<string, Record<string, string>> | undefined,
    constants: schema.constants,
  };
  if (scene === "list") {
    const columns = projectColumns(schema, locale);
    return {
      id: `${model}:list`,
      domain: model,
      title: schema.meta.title,
      meta: pageMeta(schema, scene),
      resources,
      blocks: [
        {
          name: "main",
          type: "list",
          service: "records.list",
          params: { model },
          pagination: { current: 1, pageSize: schema.meta.defaultPageSize ?? 10 },
          columns,
        },
        { name: "form", type: "form", formSchema },
        { name: "filter", type: "form", formSchema: projectFilter(schema, locale) },
      ],
      layout: {
        component: "record-page",
        children: [
          injectListNode(schema["x-layout"], columns, model),
          { component: "overlay", props: { title: schema.meta.title } },
        ],
      },
    };
  }

  return {
    id: `${model}:${scene}:${recordId ?? "new"}`,
    domain: model,
    title: schema.meta.title,
    meta: pageMeta(schema, scene),
    resources,
    blocks: [{ name: "form", type: "form", formSchema }],
    layout: {
      component: "record-page",
      children: [
        {
          component: "action-page",
          block: "form",
          props: { mode: scene, recordId, model },
        },
      ],
    },
  };
}

export function buildPreviewPage(schema: ModelSchema, locale: Locale = "zh"): PageSchema {
  return {
    id: `${schema.meta.name || "new-model"}:builder-preview`,
    domain: schema.meta.name || "builder-preview",
    title: schema.meta.title,
    meta: { ...pageMeta(schema, "add"), preview: true },
    resources: {
      i18n: schema.i18n as Record<string, Record<string, string>> | undefined,
      constants: schema.constants,
    },
    blocks: [{ name: "form", type: "form", formSchema: projectForm(schema, locale) }],
    layout: { component: "builder-preview", block: "form" },
  };
}
