export interface ComponentMeta {
  type?: string;
  kind?: "leaf" | "complex";
  dataSource?: boolean;
  children?: "properties" | "items";
}

export interface ComponentRegistration {
  code: string;
  component: unknown;
  meta?: ComponentMeta;
  adapter?: "native" | "alien";
}

export interface ServiceRegistration {
  code: string;
  send: (...args: any[]) => unknown;
}

interface Entry<T> {
  global?: T;
  domains: Map<string, T>;
}

export class Registry<T> {
  private readonly entries = new Map<string, Entry<T>>();

  set(code: string, value: T, domain?: string): void {
    const entry = this.entries.get(code) ?? { domains: new Map<string, T>() };
    if (domain) entry.domains.set(domain, value);
    else entry.global = value;
    this.entries.set(code, entry);
  }

  get(code: string, domain?: string): T | undefined {
    const entry = this.entries.get(code);
    return (domain ? entry?.domains.get(domain) : undefined) ?? entry?.global;
  }

  values(domain?: string): Array<[string, T]> {
    return Array.from(this.entries, ([code, entry]) => {
      const value = (domain ? entry.domains.get(domain) : undefined) ?? entry.global;
      return [code, value] as const;
    }).filter((entry): entry is [string, T] => entry[1] !== undefined);
  }
}

export function toNamespace(entries: Array<[string, unknown]>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [code, value] of entries) {
    const parts = code.split(".");
    let target = root;
    for (const part of parts.slice(0, -1)) {
      const child = target[part];
      if (!child || typeof child !== "object") target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts.at(-1)!] = value;
  }
  return root;
}
