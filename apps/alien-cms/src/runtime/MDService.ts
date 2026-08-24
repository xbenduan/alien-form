import type { RegisterDescribe, ServiceDescribe } from "./describe";

export class MDService {
  private readonly global = new Map<string, ServiceDescribe>();
  private readonly domains = new Map<string, Map<string, ServiceDescribe>>();

  registerGlobal(services: RegisterDescribe["services"]): void {
    services?.forEach((service) => this.global.set(service.code, service));
  }

  registerDomain(domain: string, services: RegisterDescribe["services"]): void {
    if (!services?.length) return;
    const map = this.domains.get(domain) ?? new Map<string, ServiceDescribe>();
    services.forEach((service) => map.set(service.code, service));
    this.domains.set(domain, map);
  }

  clearDomain(domain: string): void {
    this.domains.delete(domain);
  }

  query(code: string, domain?: string): ServiceDescribe | undefined {
    return this.domains.get(domain ?? "")?.get(code) ?? this.global.get(code);
  }
}
