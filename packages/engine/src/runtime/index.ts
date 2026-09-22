import { createForm, type FormInstance } from "@alien-form/core";
import type { ComponentCapability, EnumCapability, RuntimeCapability } from "@alien-form/protocol";
import { compileModel, matchPage } from "../compiler";
import type { ModelSchema, CompiledPage } from "../protocol";
import {
  Registry,
  type ComponentDefinition,
  type ComponentRegistration,
  type RuntimeDefinition,
} from "../registry";

export type SchemaLoader = (modelCode: string) => Promise<ModelSchema>;
export type RuntimeService = (...args: any[]) => unknown;
type RegistrationKind = "component" | "service" | "enum" | "util";
type OverrideKeys = Record<RegistrationKind, Set<string>>;
const namespaceMember = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function createServiceAccessor(
  registry: Registry<RuntimeDefinition<RuntimeService>>,
  domain: string | undefined,
): (code: string) => RuntimeService {
  return (code) => {
    const definition = registry.get(code, domain);
    if (definition === undefined) throw new Error(`$service("${code}") 未注册`);
    return definition.value;
  };
}

function createNamespace<T>(
  registry: Registry<RuntimeDefinition<T>>,
  domain: string | undefined,
): Readonly<Record<string, T>> {
  return Object.freeze(
    Object.fromEntries(
      registry.values(domain).map(([code, definition]) => [code, definition.value]),
    ),
  );
}

function assertNamespaceMember(kind: "utils" | "enum", key: string): void {
  if (!namespaceMember.test(key)) {
    throw new Error(`${kind} "${key}" 必须是合法的 JavaScript 属性名，以支持命名空间表达式访问`);
  }
}

export class Runtime {
  private readonly components = new Registry<ComponentRegistration>("component");
  private readonly services = new Registry<RuntimeDefinition<RuntimeService>>("service");
  private readonly enums = new Registry<RuntimeDefinition<unknown>>("enum");
  private readonly utilities = new Registry<RuntimeDefinition<unknown>>("util");
  private globalOverrideKeys?: OverrideKeys;
  private schemaLoader?: SchemaLoader;

  component(code: string, definition: ComponentDefinition, domain?: string): void {
    const registration = { code, ...definition };
    this.components.set(
      code,
      registration,
      domain,
      this.canReplaceGlobal("component", code, domain),
    );
  }

  service(code: string, definition: RuntimeDefinition<RuntimeService>, domain?: string): void {
    this.services.set(code, definition, domain, this.canReplaceGlobal("service", code, domain));
  }

  getService(code: string, domain?: string): RuntimeService {
    const definition = this.services.get(code, domain);
    if (!definition) throw new Error(`service "${code}" 未注册`);
    return definition.value;
  }

  util(code: string, definition: RuntimeDefinition<unknown>, domain?: string): void {
    assertNamespaceMember("utils", code);
    this.utilities.set(code, definition, domain, this.canReplaceGlobal("util", code, domain));
  }

  enum(code: string, definition: RuntimeDefinition<unknown>, domain?: string): void {
    assertNamespaceMember("enum", code);
    this.enums.set(code, definition, domain, this.canReplaceGlobal("enum", code, domain));
  }

  withGlobalOverrides(register: (runtime: Runtime) => void): void {
    const isRoot = this.globalOverrideKeys === undefined;
    if (isRoot) {
      this.globalOverrideKeys = {
        component: new Set(),
        service: new Set(),
        enum: new Set(),
        util: new Set(),
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

  getCapabilities(domain?: string): {
    components: ComponentCapability[];
    services: RuntimeCapability[];
    utilities: RuntimeCapability[];
    enums: EnumCapability[];
  } {
    return {
      components: this.components
        .values(domain)
        .map(([code, definition]) => ({ code, meta: definition.meta })),
      services: this.services
        .values(domain)
        .map(([code, definition]) => ({ code, description: definition.description })),
      utilities: this.utilities
        .values(domain)
        .map(([code, definition]) => ({ code, description: definition.description })),
      enums: this.enums.values(domain).map(([code, definition]) => ({
        code,
        description: definition.description,
        value: definition.value,
      })),
    };
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
