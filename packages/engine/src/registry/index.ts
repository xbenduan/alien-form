import type { ComponentCapability } from "@alien-form/protocol";

export type ComponentMeta = NonNullable<ComponentCapability["meta"]>;

export interface ComponentDefinition {
  component: unknown;
  injectContext?: boolean;
  meta?: ComponentMeta;
}

export interface ComponentRegistration extends ComponentDefinition {
  code: string;
}

export interface RuntimeDefinition<T> {
  value: T;
  description: string;
}

export function defineComponent(
  component: unknown,
  options: Omit<ComponentDefinition, "component"> = {},
): ComponentDefinition {
  return { component, ...options };
}

export function defineService<T>(value: T, options: { description: string }): RuntimeDefinition<T> {
  return { value, ...options };
}

export function defineUtil<T>(value: T, options: { description: string }): RuntimeDefinition<T> {
  return { value, ...options };
}

export function defineEnum<T>(value: T, options: { description: string }): RuntimeDefinition<T> {
  return { value, ...options };
}

interface Entry<T> {
  global?: T;
  domains: Map<string, T>;
}

export class Registry<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly kind: string) {}

  set(code: string, value: T, domain?: string, replace = false): void {
    const entry = this.entries.get(code) ?? { domains: new Map<string, T>() };
    const scope = domain === undefined ? "global" : `domain "${domain}"`;
    const duplicated =
      domain === undefined ? Object.hasOwn(entry, "global") : entry.domains.has(domain);
    if (duplicated && !replace) {
      throw new Error(`${this.kind} "${code}" 在 ${scope} 下重复注册`);
    }
    if (domain === undefined) entry.global = value;
    else entry.domains.set(domain, value);
    this.entries.set(code, entry);
  }

  get(code: string, domain?: string): T | undefined {
    const entry = this.entries.get(code);
    return (domain !== undefined ? entry?.domains.get(domain) : undefined) ?? entry?.global;
  }

  values(domain?: string): Array<[string, T]> {
    return Array.from(this.entries, ([code, entry]) => {
      const value = (domain !== undefined ? entry.domains.get(domain) : undefined) ?? entry.global;
      return [code, value] as const;
    }).filter((entry): entry is [string, T] => entry[1] !== undefined);
  }
}
