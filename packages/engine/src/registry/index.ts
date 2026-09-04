import type { FieldSchema } from "@alien-form/validate";

/** 组件使用场景：form-schema 只能用 form；page 的 properties 可用 page 与 antd。 */
export type ComponentAdapter = "page" | "form" | "antd";

export interface ComponentMeta {
  type?: string;
  kind?: "leaf" | "complex";
  dataSource?: boolean;
  children?: "properties" | "items";
  /** 选择该组件新增字段时带出的示例 schema（编辑时不带出）。 */
  sample?: Partial<FieldSchema>;
}

export interface ComponentRegistration {
  code: string;
  component: unknown;
  meta?: ComponentMeta;
  /** 使用场景与渲染注入契约：page/form 均注入 alien props；antd 为原子组件，纯 props 透传。 */
  adapter?: ComponentAdapter;
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
