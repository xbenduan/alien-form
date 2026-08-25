export class RegistryNamespace<T> {
  private global = new Map<string, T>();
  private domains = new Map<string, Map<string, T>>();

  registerGlobal(entries: Record<string, T>): void {
    for (const [code, desc] of Object.entries(entries)) {
      this.global.set(code, desc);
    }
  }

  registerDomain(domain: string, entries: Record<string, T>): void {
    const map = this.domains.get(domain) ?? new Map<string, T>();
    for (const [code, desc] of Object.entries(entries)) {
      map.set(code, desc);
    }
    this.domains.set(domain, map);
  }

  clearDomain(domain: string): void {
    this.domains.delete(domain);
  }

  resolve(code: string, domain?: string): T | undefined {
    return this.domains.get(domain ?? "")?.get(code) ?? this.global.get(code);
  }

  all(domain?: string): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [k, v] of this.global) result[k] = v;
    const domainMap = this.domains.get(domain ?? "");
    if (domainMap) for (const [k, v] of domainMap) result[k] = v;
    return result;
  }
}
