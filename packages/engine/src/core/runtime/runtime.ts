import { AtomStore } from "../store";
import {
  createRegistry,
  type ComponentDescriptor,
  type FunctionDescriptor,
  type Registry,
  type ServiceDescriptor,
} from "../registry";
import type { RuntimeRuleHandler } from "@alien-form/core";
import { PageBus } from "../bus/page-bus";
import { SharedShelf } from "../bus/shelf";
import { SchemaTranslator } from "../compiler/translator";
import { PageCompiler } from "../compiler/page-compiler";
import { constantPlugin, i18nPlugin } from "../plugins";
import type { RouterAdapter } from "../router";
import type { PageSchema } from "../dsl";
import type { TranslatorPlugin } from "../compiler/types";
import { PageRuntime } from "../page/runtime";
import type { CompiledPage } from "../dsl";

export interface RuntimeOptions {
  store?: AtomStore;
  plugins?: TranslatorPlugin[];
  locale?: string;
  router?: RouterAdapter;
}

export class Runtime {
  readonly store: AtomStore;
  readonly registry: Registry;
  readonly bus: PageBus;
  readonly shelf: SharedShelf;
  readonly translator: SchemaTranslator;
  readonly compiler: PageCompiler;
  readonly locale: string;
  router?: RouterAdapter;

  private pages = new Map<string, PageRuntime>();
  private pageSequence = 0;

  constructor(options: RuntimeOptions = {}) {
    this.store = options.store ?? new AtomStore();
    this.registry = createRegistry();
    this.bus = new PageBus();
    this.shelf = new SharedShelf();
    this.locale = options.locale ?? "zh";

    this.translator = new SchemaTranslator();
    this.translator.use(constantPlugin);
    this.translator.use(i18nPlugin);
    for (const plugin of options.plugins ?? []) {
      this.translator.use(plugin);
    }

    this.compiler = new PageCompiler(this.translator);
    this.router = options.router;
  }

  component<T = unknown>(code: string, descriptor: ComponentDescriptor<T>, domain?: string): void {
    if (domain) {
      this.registry.components.registerDomain(domain, { [code]: descriptor });
    } else {
      this.registry.components.registerGlobal({ [code]: descriptor });
    }
  }

  service(descriptor: ServiceDescriptor, domain?: string): void {
    if (domain) {
      this.registry.services.registerDomain(domain, { [descriptor.code]: descriptor });
    } else {
      this.registry.services.registerGlobal({ [descriptor.code]: descriptor });
    }
  }

  fn(descriptor: FunctionDescriptor, domain?: string): void {
    if (domain) {
      this.registry.functions.registerDomain(domain, { [descriptor.code]: descriptor });
    } else {
      this.registry.functions.registerGlobal({ [descriptor.code]: descriptor });
    }
  }

  constant(key: string, value: unknown, domain?: string): void {
    if (domain) {
      this.registry.constants.registerDomain(domain, { [key]: value });
    } else {
      this.registry.constants.registerGlobal({ [key]: value });
    }
  }

  formComponent(code: string, component: unknown, domain?: string): void {
    if (domain) {
      this.registry.form.components.registerDomain(domain, { [code]: component });
    } else {
      this.registry.form.components.registerGlobal({ [code]: component });
    }
  }

  formDecorator(code: string, decorator: unknown, domain?: string): void {
    if (domain) {
      this.registry.form.decorators.registerDomain(domain, { [code]: decorator });
    } else {
      this.registry.form.decorators.registerGlobal({ [code]: decorator });
    }
  }

  formHandler(code: string, handler: RuntimeRuleHandler, domain?: string): void {
    if (domain) {
      this.registry.form.handlers.registerDomain(domain, { [code]: handler });
    } else {
      this.registry.form.handlers.registerGlobal({ [code]: handler });
    }
  }

  use(plugin: TranslatorPlugin): void {
    this.translator.use(plugin);
  }

  async createPage(schema: PageSchema): Promise<PageRuntime> {
    const compiled = await this.compiler.compile(schema, {
      locale: this.locale,
      runtime: this,
      domain: schema.domain,
      store: {},
    });
    const page = new PageRuntime(
      schema,
      this,
      compiled as CompiledPage,
      `page-${++this.pageSequence}`,
    );
    this.pages.set(page.instanceId, page);
    return page;
  }

  getPage(instanceId: string): PageRuntime | undefined {
    return this.pages.get(instanceId);
  }

  destroyPage(page: PageRuntime): void {
    if (this.pages.get(page.instanceId) !== page) return;
    page.unmount();
    this.pages.delete(page.instanceId);
  }
}
