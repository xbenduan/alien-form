import { createForm, type FormInstance } from "@alien-form/core";
import { compileModel, matchPage } from "../compiler";
import type { ModelSchema, CompiledPage } from "../protocol";
import { Registry, type ComponentRegistration } from "../registry";

export type SchemaLoader = (modelCode: string) => Promise<ModelSchema>;
export type RuntimeService = (...args: any[]) => unknown;
type RegistrationKind = "component" | "service" | "enum" | "utils";
type OverrideKeys = Record<RegistrationKind, Set<string>>;
const namespaceMember = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function createServiceAccessor(
  registry: Registry<RuntimeService>,
  domain: string | undefined,
): (code: string) => RuntimeService {
  return (code) => {
    const value = registry.get(code, domain);
    if (value === undefined) throw new Error(`$service("${code}") 未注册`);
    return value;
  };
}

function createNamespace<T>(
  registry: Registry<T>,
  domain: string | undefined,
): Readonly<Record<string, T>> {
  return Object.freeze(Object.fromEntries(registry.values(domain)));
}

function assertNamespaceMember(kind: "utils" | "enum", key: string): void {
  if (!namespaceMember.test(key)) {
    throw new Error(`${kind} "${key}" 必须是合法的 JavaScript 属性名，以支持命名空间表达式访问`);
  }
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

  getService(code: string, domain?: string): RuntimeService {
    const service = this.services.get(code, domain);
    if (!service) throw new Error(`service "${code}" 未注册`);
    return service;
  }

  utils(key: string, value: unknown, domain?: string): void {
    assertNamespaceMember("utils", key);
    this.utilities.set(key, value, domain, this.canReplaceGlobal("utils", key, domain));
  }

  enum(key: string, value: unknown, domain?: string): void {
    assertNamespaceMember("enum", key);
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
      $service: createServiceAccessor(this.services, domain),
      $utils: createNamespace(this.utilities, domain),
      $enums: createNamespace(this.enums, domain),
      $query: query,
    };
  }

  useSchemaLoader(loader: SchemaLoader): void {
    this.schemaLoader = loader;
  }

  async loadModel(modelCode: string): Promise<ModelSchema> {
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
    readonly model: ModelSchema,
    readonly page: CompiledPage,
    readonly query: Record<string, string>,
  ) {
    this.domain = model.name;
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
