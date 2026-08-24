import type { RegisterDescribe } from "./describe";

export class MDForm {
  private readonly global: Required<NonNullable<RegisterDescribe["form"]>> = {
    components: {},
    decorators: {},
    handlers: {},
  };

  private readonly domains = new Map<string, RegisterDescribe["form"]>();

  registerGlobal(form?: RegisterDescribe["form"]): void {
    if (!form) return;
    this.global.components = { ...this.global.components, ...form.components };
    this.global.decorators = { ...this.global.decorators, ...form.decorators };
    this.global.handlers = { ...this.global.handlers, ...form.handlers };
  }

  registerDomain(domain: string, form?: RegisterDescribe["form"]): void {
    if (form) this.domains.set(domain, form);
  }

  clearDomain(domain: string): void {
    this.domains.delete(domain);
  }

  resolve(domain?: string): Required<NonNullable<RegisterDescribe["form"]>> {
    const form = this.domains.get(domain ?? "");
    return {
      components: { ...this.global.components, ...form?.components },
      decorators: { ...this.global.decorators, ...form?.decorators },
      handlers: { ...this.global.handlers, ...form?.handlers },
    };
  }
}
