import { createForm, type FormInstance } from "@alien-form/core";
import { compileModel, matchPage } from "../compiler";
import type { BuilderSchema, CompiledPage } from "../protocol";
import { Registry, type ComponentRegistration } from "../registry";

export type SchemaLoader = (modelCode: string) => Promise<BuilderSchema>;
export type RuntimeAccessor<T = unknown> = (code: string) => T;
export type RuntimeService = (...args: any[]) => unknown;
type RegistrationKind = "component" | "service" | "enum" | "utils";
type OverrideKeys = Record<RegistrationKind, Set<string>>;

function createAccessor<T>(
  registry: Registry<T>,
  domain: string | undefined,
  namespace: string,
): RuntimeAccessor<T> {
  return (code) => {
    const value = registry.get(code, domain);
    if (value === undefined) throw new Error(`${namespace}("${code}") 未注册`);
    return value;
  };
}

export class Runtime {
  private readonly components = new Registry<ComponentRegistration>("component");
  private readonly services = new Registry<RuntimeService>("service");
  private readonly enums = new Registry<unknown>("enum");
  private readonly utilities = new Registry<unknown>("utils");
  private globalOverrideKeys?: OverrideKeys;
  private schemaLoader?: SchemaLoader;

  component(registration: ComponentRegistration, domain?: string): void {
    this.components.set(
      registration.code,
      registration,
      domain,
      this.canReplaceGlobal("component", registration.code, domain),
    );
  }

  service(code: string, send: RuntimeService, domain?: string): void {
    this.services.set(code, send, domain, this.canReplaceGlobal("service", code, domain));
  }

  utils(key: string, value: unknown, domain?: string): void {
    this.utilities.set(key, value, domain, this.canReplaceGlobal("utils", key, domain));
  }

  enum(key: string, value: unknown, domain?: string): void {
    this.enums.set(key, value, domain, this.canReplaceGlobal("enum", key, domain));
  }

  withGlobalOverrides(register: (runtime: Runtime) => void): void {
    const isRoot = this.globalOverrideKeys === undefined;
    if (isRoot) {
      this.globalOverrideKeys = {
        component: new Set(),
        service: new Set(),
        enum: new Set(),
        utils: new Set(),
      };
    }
    try {
      register(this);
    } finally {
      if (isRoot) this.globalOverrideKeys = undefined;
    }
  }

  resolveComponent(code: string, domain?: string): ComponentRegistration | undefined {
    return this.components.get(code, domain);
  }

  /** 枚举已注册组件的 code（用于构建器字段类型下拉）。 */
  componentCodes(domain?: string): string[] {
    return this.components.values(domain).map(([code]) => code);
  }

  /** 枚举当前作用域内生效的工具。 */
  utilityEntries(domain?: string): Array<[string, unknown]> {
    return this.utilities.values(domain);
  }

  /** 枚举当前作用域内生效的枚举。 */
  enumEntries(domain?: string): Array<[string, unknown]> {
    return this.enums.values(domain);
  }

  private canReplaceGlobal(kind: RegistrationKind, code: string, domain?: string): boolean {
    if (domain !== undefined || !this.globalOverrideKeys) return false;
    const keys = this.globalOverrideKeys[kind];
    if (keys.has(code)) {
      throw new Error(`${kind} "${code}" 在 overrides 下重复注册`);
    }
    keys.add(code);
    return true;
  }

  createScope(
    domain: string | undefined,
    query: Record<string, string>,
    mode?: string,
  ): Record<string, unknown> {
    return {
      mode,
      $service: createAccessor(this.services, domain, "$service"),
      $utils: createAccessor(this.utilities, domain, "$utils"),
      $enum: createAccessor(this.enums, domain, "$enum"),
      $query: query,
    };
  }

  useSchemaLoader(loader: SchemaLoader): void {
    this.schemaLoader = loader;
  }

  async loadModel(modelCode: string): Promise<BuilderSchema> {
    if (!this.schemaLoader) throw new Error("Schema loader is not configured");
    return this.schemaLoader(modelCode);
  }

  async createPage(
    modelCode: string,
    routerSegment: string,
    query: Record<string, string>,
  ): Promise<PageRuntime> {
    const model = await this.loadModel(modelCode);
    const page = matchPage(compileModel(model), routerSegment);
    if (!page) throw new Error(`Page route not found: ${modelCode}/${routerSegment}`);
    return new PageRuntime(this, model, page, query);
  }
}

export class PageRuntime {
  readonly form: FormInstance;

  constructor(
    readonly runtime: Runtime,
    readonly model: BuilderSchema,
    readonly page: CompiledPage,
    readonly query: Record<string, string>,
  ) {
    this.domain = model.meta.name;
    this.form = createForm({
      schema: page.schema,
      scope: runtime.createScope(this.domain, query, page.router),
    });
  }

  readonly domain: string;

  mount(): void {
    this.form.mount();
  }

  destroy(): void {
    this.form.destroy();
  }
}
