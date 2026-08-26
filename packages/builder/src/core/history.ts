export class History<T> {
  private entries: T[];
  private cursor = 0;
  private readonly limit: number;

  constructor(initial: T, limit = 100) {
    this.entries = [initial];
    this.limit = limit;
  }

  get current(): T {
    return this.entries[this.cursor];
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  push(value: T): void {
    this.entries = [...this.entries.slice(0, this.cursor + 1), value];
    if (this.entries.length > this.limit) this.entries.shift();
    this.cursor = this.entries.length - 1;
  }

  undo(): T | undefined {
    if (!this.canUndo) return undefined;
    this.cursor -= 1;
    return this.current;
  }

  redo(): T | undefined {
    if (!this.canRedo) return undefined;
    this.cursor += 1;
    return this.current;
  }

  reset(value: T): void {
    this.entries = [value];
    this.cursor = 0;
  }
}
