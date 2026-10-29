import { FormworkError } from "../model/errors";
import { modelDocumentSchema } from "../model/schema";
import type { DomainDefinition, FormworkDefinition, PageDefinition, RenderDefaults } from "./types";

export function mergeDefaults(...layers: RenderDefaults[]): RenderDefaults {
  const result: RenderDefaults = { components: {}, fn: {}, schema: modelDocumentSchema };
  for (const layer of layers) {
    for (const name of ["container", "fieldContainer", "getSchema", "schema"] as const)
      if (Object.hasOwn(layer, name) && layer[name] !== undefined) (result as Record<string, unknown>)[name] = layer[name];
    result.components = { ...result.components, ...layer.components };
    result.fn = { ...result.fn, ...layer.fn };
  }
  return result;
}
export async function resolveDefinition(app: FormworkDefinition, definition: PageDefinition, domain?: string): Promise<RenderDefaults> {
  let override: DomainDefinition = {};
  const entry = domain && Object.hasOwn(definition.domains ?? {}, domain) ? definition.domains![domain] : undefined;
  if (entry) {
    override = typeof entry === "function" ? (await entry()).default : entry;
    if (!override || typeof override !== "object") throw new FormworkError("INVALID_DOMAIN", `Domain 导出无效 ${domain}`);
  }
  return mergeDefaults(app, definition as RenderDefaults, override);
}
