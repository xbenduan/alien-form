import type { RegisterDescribe } from "./describe";

export class MDConstant {
  private global: Record<string, unknown> = {};
  private readonly domains = new Map<string, Record<string, unknown>>();

  registerGlobal(constants?: RegisterDescribe["constant"]): void {
    if (constants) this.global = { ...this.global, ...constants };
  }

  registerDomain(domain: string, constants?: RegisterDescribe["constant"]): void {
    if (constants) {
      this.domains.set(domain, {
        ...this.domains.get(domain),
        ...constants,
      });
    }
  }

  clearDomain(domain: string): void {
    this.domains.delete(domain);
  }

  all(domain?: string): Record<string, unknown> {
    return { ...this.global, ...(domain ? this.domains.get(domain) : {}) };
  }
}
