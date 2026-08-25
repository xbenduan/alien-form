type Handler = (payload: unknown) => unknown | Promise<unknown>;

export class PageBus {
  private handlers = new Map<string, Set<Handler>>();

  emit(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(`[alien-page bus:${event}]`, e);
      }
    });
  }

  on(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  once(event: string, handler: Handler): () => void {
    const off = this.on(event, (payload) => {
      off();
      return handler(payload);
    });
    return off;
  }

  async request<T = unknown>(event: string, payload?: unknown): Promise<T | undefined> {
    const set = this.handlers.get(event);
    if (!set) return undefined;
    for (const h of set) {
      const result = await h(payload);
      if (result !== undefined) return result as T;
    }
    return undefined;
  }
}
