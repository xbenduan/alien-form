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
  private readonly constants = new Registry<unknown>();
  private schemaLoader?: SchemaLoader;

  constructor(private readonly utilities: Record<string, unknown> = {}) {}

  component(registration: ComponentRegistration, domain?: string): void {
    this.components.set(registration.code, registration, domain);
  }

  service(registration: ServiceRegistration, domain?: string): void {
    this.services.set(registration.code, registration, domain);
  }

  constant(key: string, value: unknown, domain?: string): void {
    this.constants.set(key, value, domain);
  }

  resolveComponent(code: string, domain?: string): ComponentRegistration | undefined {
    return this.components.get(code, domain);
  }

  createScope(domain: string | undefined, query: Record<string, string>): Record<string, unknown> {
    return {
      $service: toNamespace(
        this.services.values(domain).map(([code, registration]) => [code, registration.send]),
      ),
      $utils: this.utilities,
      $enums: toNamespace(this.constants.values(domain)),
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
    return new PageRuntime(this, modelCode, page, query);
  }
}

export class PageRuntime {
  readonly form: FormInstance;

  constructor(
    readonly runtime: Runtime,
    readonly domain: string,
    readonly page: CompiledPage,
    readonly query: Record<string, string>,
  ) {
    this.form = createForm({
      schema: page.schema,
      scope: runtime.createScope(domain, query),
    });
  }

  mount(): void {
    this.form.mount();
  }

  destroy(): void {
    this.form.destroy();
  }
}
