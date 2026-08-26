import type { AnyFieldDefinition } from "./types";

export class BuilderRegistry {
  private readonly globalDefinitions = new Map<string, AnyFieldDefinition>();
  private readonly domainDefinitions = new Map<string, Map<string, AnyFieldDefinition>>();

  registerGlobal(definitions: AnyFieldDefinition[] | Record<string, AnyFieldDefinition>): void {
    for (const definition of normalizeDefinitions(definitions)) {
      this.globalDefinitions.set(definition.code, definition);
    }
  }

  registerDomain(
    domain: string,
    definitions: AnyFieldDefinition[] | Record<string, AnyFieldDefinition>,
  ): void {
    const registry = this.domainDefinitions.get(domain) ?? new Map<string, AnyFieldDefinition>();
    for (const definition of normalizeDefinitions(definitions)) {
      registry.set(definition.code, definition);
    }
    this.domainDefinitions.set(domain, registry);
  }

  resolve<T extends AnyFieldDefinition = AnyFieldDefinition>(code: string, domain?: string): T | undefined {
    return (this.domainDefinitions.get(domain ?? "")?.get(code) ??
      this.globalDefinitions.get(code)) as T | undefined;
  }

  all<T extends AnyFieldDefinition = AnyFieldDefinition>(domain?: string): Record<string, T> {
    const definitions = Object.fromEntries(this.globalDefinitions) as Record<string, T>;
    const domainRegistry = this.domainDefinitions.get(domain ?? "");
    if (domainRegistry) {
      for (const [code, definition] of domainRegistry) definitions[code] = definition as T;
    }
    return definitions;
  }

  clearDomain(domain: string): void {
    this.domainDefinitions.delete(domain);
  }
}

function normalizeDefinitions(
  definitions: AnyFieldDefinition[] | Record<string, AnyFieldDefinition>,
): AnyFieldDefinition[] {
  return Array.isArray(definitions) ? definitions : Object.values(definitions);
}
