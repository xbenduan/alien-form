import type { DataSourceItem, RuntimeRuleHandler } from "@alien-form/core";

export interface SchemaHandlerCatalogItem {
  name: string;
  label: string;
  description: string;
  supportedTargets: Array<"value" | "display" | "disabled" | "required" | "title" | "description" | "props" | "dataSource">;
  defaultConfig: Record<string, unknown>;
}

function toOptions(items: unknown): DataSourceItem[] {
  return Array.isArray(items) ? (items as DataSourceItem[]) : [];
}

/**
 * Read handler config from field schema x-cms.reactions[target].
 */
function getHandlerConfig(ctx: { schema: any; key?: string }): Record<string, unknown> {
  const xcms = ctx.schema?.["x-cms"];
  if (!xcms?.reactions) return {};
  const target = ctx.key ?? "";
  const config = xcms.reactions[target];
  return config && typeof config === "object" ? config : {};
}

export const schemaHandlers: Record<string, RuntimeRuleHandler> = {
  copyFromSelector: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? "");
    return selector ? ctx.get(selector) : undefined;
  },

  compareValue: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? "");
    const expected = config.equals;
    const current = selector ? ctx.get(selector) : ctx.value;
    const matched = current === expected;
    return matched ? config.whenTrue : config.whenFalse;
  },

  optionsFromMap: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? "");
    const key = String(selector ? ctx.get(selector) ?? "default" : "default");
    const map = (config.map ?? {}) as Record<string, unknown>;
    return toOptions(map[key] ?? map.default);
  },

  templateText: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? "");
    const value = selector ? ctx.get(selector) : ctx.value;
    const prefix = String(config.prefix ?? "");
    const suffix = String(config.suffix ?? "");
    return `${prefix}${value ?? ""}${suffix}`;
  },
};

export const schemaHandlerCatalog: SchemaHandlerCatalogItem[] = [
  {
    name: "copyFromSelector",
    label: "Copy Field Value",
    description: "Read value from a selector path. Used for value/title/description derivation.",
    supportedTargets: ["value", "title", "description"],
    defaultConfig: { selector: "otherField" },
  },
  {
    name: "compareValue",
    label: "Compare Value",
    description: "Compare a selector value against expected. Returns whenTrue/whenFalse.",
    supportedTargets: ["value", "display", "disabled", "required", "title", "description"],
    defaultConfig: { selector: "status", equals: "draft", whenTrue: true, whenFalse: false },
  },
  {
    name: "optionsFromMap",
    label: "Options From Map",
    description: "Return dataSource options based on a selector value lookup in a map.",
    supportedTargets: ["dataSource"],
    defaultConfig: { selector: "category", map: { default: [] } },
  },
  {
    name: "templateText",
    label: "Template Text",
    description: "Read a selector value and concatenate with prefix/suffix.",
    supportedTargets: ["value", "title", "description"],
    defaultConfig: { selector: "title", prefix: "", suffix: " (preview)" },
  },
];
