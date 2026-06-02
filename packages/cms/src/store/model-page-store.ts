import { signal, computed } from "@alien-form/core";
import type { Signal, Computed } from "@alien-form/core";
import type { RecordProvider } from "../provider/record-provider";
import type { CmsModelSchema, ModelActionKind, ModelActionOpenMode } from "../types/schema";
import type { ModelRecord } from "../types/record";
import type { Pagination, Sorter } from "../types/common";
import type { FilterSchemaProjection, MobileCardProjection, TableColumnProjection } from "../projection/types";
import { projectFilterSchema } from "../projection/project-filter-schema";
import { projectTableColumns } from "../projection/project-table-columns";
import { projectMobileCard } from "../projection/project-mobile-card";

export type ModelActionMode = "closed" | ModelActionKind;

export interface ModelPageStoreConfig {
  modelName: string;
  schema: CmsModelSchema;
  recordProvider: RecordProvider;
  tableVisibleKeys?: string[];
}

/**
 * Framework-agnostic state machine for a model CRUD page.
 * Uses alien-signals for reactivity. UI frameworks subscribe to signals.
 */
export class ModelPageStore {
  readonly modelName: string;
  readonly schema: CmsModelSchema;
  private readonly provider: RecordProvider;

  // ─── Static projections (computed once) ─────────────────────
  readonly filterSchema: FilterSchemaProjection["schema"];
  readonly filterDefaultVisibleKeys: FilterSchemaProjection["defaultVisibleKeys"];
  readonly tableColumns: TableColumnProjection[];
  readonly mobileCard: MobileCardProjection;
  readonly singularLabel: string;
  readonly pluralLabel: string;

  // ─── List state ─────────────────────────────────────────────
  readonly filters: Signal<Record<string, unknown>>;
  readonly pagination: Signal<Pagination>;
  readonly sorter: Signal<Sorter | undefined>;
  readonly records: Signal<ModelRecord[]>;
  readonly total: Signal<number>;
  readonly listLoading: Signal<boolean>;

  // ─── Action state ───────────────────────────────────────────
  readonly actionMode: Signal<ModelActionMode>;
  readonly activeRecordId: Signal<string | undefined>;
  readonly activeRecord: Signal<ModelRecord | undefined>;
  readonly detailLoading: Signal<boolean>;
  readonly submitting: Signal<boolean>;

  // ─── Computed ───────────────────────────────────────────────
  readonly actionOpenMode: Computed<ModelActionOpenMode | undefined>;

  constructor(config: ModelPageStoreConfig) {
    this.modelName = config.modelName;
    this.schema = config.schema;
    this.provider = config.recordProvider;

    // Projections
    const filterProjection = projectFilterSchema(config.schema);
    this.filterSchema = filterProjection.schema;
    this.filterDefaultVisibleKeys = filterProjection.defaultVisibleKeys;
    this.tableColumns = projectTableColumns(config.schema, {
      visibleKeysOverride: config.tableVisibleKeys,
    });
    this.mobileCard = projectMobileCard(config.schema);
    this.singularLabel = config.schema["x-model"]?.singularLabel ?? "Record";
    this.pluralLabel = config.schema["x-model"]?.pluralLabel ?? "Records";

    // Signals
    const defaultPageSize = config.schema["x-model"]?.defaultPageSize ?? 10;
    this.filters = signal<Record<string, unknown>>({});
    this.pagination = signal<Pagination>({ current: 1, pageSize: defaultPageSize });
    this.sorter = signal<Sorter | undefined>(undefined);
    this.records = signal<ModelRecord[]>([]);
    this.total = signal(0);
    this.listLoading = signal(false);

    this.actionMode = signal<ModelActionMode>("closed");
    this.activeRecordId = signal<string | undefined>(undefined);
    this.activeRecord = signal<ModelRecord | undefined>(undefined);
    this.detailLoading = signal(false);
    this.submitting = signal(false);

    // Computed
    const openModeMap = config.schema["x-model"]?.openMode;
    this.actionOpenMode = computed(() => {
      const mode = this.actionMode();
      if (mode === "closed") return undefined;
      return openModeMap?.[mode] ?? "drawer";
    });
  }

  // ─── List Operations ────────────────────────────────────────

  async fetchList(): Promise<void> {
    this.listLoading(true);
    try {
      const result = await this.provider.list({
        model: this.modelName,
        filters: this.filters(),
        pagination: this.pagination(),
        sorter: this.sorter(),
      });
      this.records(result.list);
      this.total(result.total);
    } finally {
      this.listLoading(false);
    }
  }

  setFilters(values: Record<string, unknown>): void {
    this.filters(values);
    this.pagination({ ...this.pagination(), current: 1 });
    this.fetchList();
  }

  setPagination(next: Pagination): void {
    this.pagination(next);
    this.fetchList();
  }

  setSorter(next?: Sorter): void {
    this.sorter(next);
    this.fetchList();
  }

  async refresh(): Promise<void> {
    await this.fetchList();
  }

  // ─── Record Operations ──────────────────────────────────────

  async fetchDetail(id: string): Promise<void> {
    this.detailLoading(true);
    try {
      const record = await this.provider.detail({ model: this.modelName, id });
      this.activeRecord(record);
    } finally {
      this.detailLoading(false);
    }
  }

  async submitAdd(values: Record<string, unknown>): Promise<boolean> {
    this.submitting(true);
    try {
      const result = await this.provider.create({ model: this.modelName, values });
      if (result.success) {
        this.closeAction();
        await this.fetchList();
        return true;
      }
      return false;
    } finally {
      this.submitting(false);
    }
  }

  async submitEdit(values: Record<string, unknown>): Promise<boolean> {
    const id = this.activeRecordId();
    if (!id) return false;

    this.submitting(true);
    try {
      const result = await this.provider.update({ model: this.modelName, id, values });
      if (result.success) {
        this.closeAction();
        await this.fetchList();
        return true;
      }
      return false;
    } finally {
      this.submitting(false);
    }
  }

  async removeRecord(id: string): Promise<boolean> {
    const result = await this.provider.delete({ model: this.modelName, id });
    if (result.success) {
      await this.fetchList();
      return true;
    }
    return false;
  }

  async batchRemove(ids: string[]): Promise<boolean> {
    if (!this.provider.batchDelete) {
      // Fallback: sequential delete
      for (const id of ids) {
        await this.provider.delete({ model: this.modelName, id });
      }
      await this.fetchList();
      return true;
    }

    const result = await this.provider.batchDelete({ model: this.modelName, ids });
    if (result.success) {
      await this.fetchList();
      return true;
    }
    return false;
  }

  // ─── Action Control ─────────────────────────────────────────

  openAdd(): void {
    this.actionMode("add");
    this.activeRecordId(undefined);
    this.activeRecord(undefined);
  }

  openEdit(id: string): void {
    this.actionMode("edit");
    this.activeRecordId(id);
    this.fetchDetail(id);
  }

  openDetail(id: string): void {
    this.actionMode("detail");
    this.activeRecordId(id);
    this.fetchDetail(id);
  }

  closeAction(): void {
    this.actionMode("closed");
    this.activeRecordId(undefined);
    this.activeRecord(undefined);
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  dispose(): void {
    // Future: clean up effects if needed
  }
}
