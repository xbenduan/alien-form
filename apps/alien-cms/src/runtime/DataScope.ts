import { computed, endBatch, signal, startBatch } from "@alien-form/core";
import type { Pagination, Sorter } from "./types";

export type ScopeFilters = Record<string, unknown>;

export class DataScope {
  readonly id: string;
  readonly model: string;
  private readonly sources = signal<Record<string, ScopeFilters>>({});
  readonly filters = computed<ScopeFilters>(() =>
    Object.values(this.sources()).reduce<ScopeFilters>(
      (merged, source) => ({ ...merged, ...source }),
      {},
    ),
  );
  readonly pagination = signal<Pagination>({ current: 1, pageSize: 10 });
  readonly sorter = signal<Sorter | undefined>(undefined);
  readonly selection = signal<string[]>([]);
  readonly refreshVersion = signal(0);

  constructor(model: string, id = "main") {
    this.model = model;
    this.id = id;
  }

  setFilterPatch(source: string, patch: ScopeFilters): void {
    startBatch();
    try {
      this.sources({ ...this.sources(), [source]: patch });
      this.pagination({ ...this.pagination(), current: 1 });
      this.refreshVersion(this.refreshVersion() + 1);
    } finally {
      endBatch();
    }
  }

  setPagination(value: Pagination): void {
    this.pagination(value);
  }

  setSorter(value?: Sorter): void {
    this.sorter(value);
  }

  /** 触发一次列表刷新（bump refreshVersion，订阅方据此重查）。 */
  refresh(): void {
    this.refreshVersion(this.refreshVersion() + 1);
  }

  setSelection(value: string[]): void {
    this.selection(value);
  }
}
