export class SharedShelf {
  private store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  take<T>(key: string): T | undefined {
    const value = this.store.get(key) as T | undefined;
    this.store.delete(key);
    return value;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}
