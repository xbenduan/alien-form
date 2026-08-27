import { AtomStore } from "../store";
import {
  createRegistry,
  type FormComponentDefinition,
  type FormDecoratorDefinition,
  type FormHandlerDefinition,
  type FunctionDescriptor,
  type Registry,
  type ServiceDescriptor,
  type UiDefinition,
} from "../registry";
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

  ui<TComponent = unknown, TAuthoring = unknown>(
    definition: UiDefinition<TComponent, TAuthoring>,
    domain?: string,
  ): void {
    if (domain) {
      this.registry.ui.registerDomain(domain, { [definition.code]: definition });
    } else {
      this.registry.ui.registerGlobal({ [definition.code]: definition });
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

  formComponent<TComponent = unknown, TAuthoring = unknown>(
    definition: FormComponentDefinition<TComponent, TAuthoring>,
    domain?: string,
  ): void {
    if (domain) {
      this.registry.form.components.registerDomain(domain, {
        [definition.code]: definition,
      });
    } else {
      this.registry.form.components.registerGlobal({ [definition.code]: definition });
    }
  }

  formDecorator<TComponent = unknown, TAuthoring = unknown>(
    definition: FormDecoratorDefinition<TComponent, TAuthoring>,
    domain?: string,
  ): void {
    if (domain) {
      this.registry.form.decorators.registerDomain(domain, {
        [definition.code]: definition,
      });
    } else {
      this.registry.form.decorators.registerGlobal({ [definition.code]: definition });
    }
  }

  formHandler<TAuthoring = unknown>(
    definition: FormHandlerDefinition<TAuthoring>,
    domain?: string,
  ): void {
    if (domain) {
      this.registry.form.handlers.registerDomain(domain, {
        [definition.code]: definition,
      });
    } else {
      this.registry.form.handlers.registerGlobal({ [definition.code]: definition });
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
    const page = new PageRuntime(this, compiled as CompiledPage, `page-${++this.pageSequence}`);
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
