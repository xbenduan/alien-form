import type { RegisterDescribe, UIComponentDescribe } from "./describe";

export class MD_UI {
  private readonly global = new Map<string, UIComponentDescribe>();
  private readonly domains = new Map<string, Map<string, UIComponentDescribe>>();

  registerGlobal(ui?: RegisterDescribe["ui"]): void {
    Object.entries(ui ?? {}).forEach(([code, describe]) => this.global.set(code, describe));
  }

  registerDomain(domain: string, ui?: RegisterDescribe["ui"]): void {
    if (!ui) return;
    const map = this.domains.get(domain) ?? new Map<string, UIComponentDescribe>();
    Object.entries(ui).forEach(([code, describe]) => map.set(code, describe));
    this.domains.set(domain, map);
  }

  clearDomain(domain: string): void {
    this.domains.delete(domain);
  }

  query(code: string, domain?: string): UIComponentDescribe | undefined {
    return this.domains.get(domain ?? "")?.get(code) ?? this.global.get(code);
  }
}
