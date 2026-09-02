import { createForm, type FormInstance } from "@alien-form/core";
import { compileModel, matchPage } from "../compiler";
import type { BuilderSchema, CompiledPage } from "../protocol";
import {
  Registry,
  toNamespace,
  type ComponentRegistration,
  type ServiceRegistration,
} from "../registry";

export type SchemaLoader = (modelCode: string) => Promise<BuilderSchema>;

export class Runtime {
  private readonly components = new Registry<ComponentRegistration>();
  private readonly services = new Registry<ServiceRegistration>();
  private readonly enums = new Registry<unknown>();
  private readonly utilities = new Registry<unknown>();
  private schemaLoader?: SchemaLoader;

  component(registration: ComponentRegistration, domain?: string): void;
  component(code: string, domain?: string): unknown;
  component(registrationOrCode: ComponentRegistration | string, domain?: string): unknown {
    if (typeof registrationOrCode === "string") {
      return this.components.get(registrationOrCode, domain)?.component;
    }
    this.components.set(registrationOrCode.code, registrationOrCode, domain);
  }

  service(registration: ServiceRegistration, domain?: string): void {
    this.services.set(registration.code, registration, domain);
  }

  utils(key: string, value: unknown, domain?: string): void {
    this.utilities.set(key, value, domain);
  }

  enum(key: string, value: unknown, domain?: string): void {
    this.enums.set(key, value, domain);
  }

  resolveComponent(code: string, domain?: string): ComponentRegistration | undefined {
    return this.components.get(code, domain);
  }

  createScope(
    domain: string | undefined,
    query: Record<string, string>,
    mode?: string,
  ): Record<string, unknown> {
    return {
      mode,
      $service: toNamespace(
        this.services.values(domain).map(([code, registration]) => [code, registration.send]),
      ),
      $utils: toNamespace(this.utilities.values(domain)),
      $enums: toNamespace(this.enums.values(domain)),
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
