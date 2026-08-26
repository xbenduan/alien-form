import { effect } from "alien-signals";
import type { Atom, AtomStore } from "../../store/atom";
import type { BlockSchema } from "../../dsl";
import { BlockRuntime } from "../block";
import type { PageRuntime } from "../runtime";
import type { Runtime } from "../../runtime/runtime";

export interface SorterState {
  field: string;
  order: "asc" | "desc";
}

export interface ListResult {
  list: unknown[];
  total: number;
}

export class ListBlockRuntime extends BlockRuntime {
  readonly filters: Atom<Record<string, unknown>>;
  readonly pagination: Atom<{ current: number; pageSize: number }>;
  readonly sorter: Atom<SorterState | undefined>;
  readonly selection: Atom<unknown[]>;
  readonly data: Atom<unknown[]>;
  readonly total: Atom<number>;
  readonly loading: Atom<boolean>;
  readonly error: Atom<Error | undefined>;
  readonly refreshVersion: Atom<number>;

  private serviceCode: string;
  private serviceParams: Record<string, unknown>;

  constructor(schema: BlockSchema, page: PageRuntime, store: AtomStore, runtime: Runtime) {
    super(schema, page, store, runtime);
    this.serviceCode = schema.service ?? "records.list";
    this.serviceParams = schema.params ?? {};

    this.filters = this.bridgeAtom<Record<string, unknown>>("filters", {});
    this.pagination = this.bridgeAtom("pagination", schema.pagination ?? { current: 1, pageSize: 10 });
    this.sorter = this.bridgeAtom<SorterState | undefined>("sorter", undefined);
    this.selection = this.bridgeAtom<unknown[]>("selection", []);
    this.data = this.bridgeAtom<unknown[]>("data", []);
    this.total = this.bridgeAtom<number>("total", 0);
    this.loading = this.bridgeAtom<boolean>("loading", false);
    this.error = this.bridgeAtom<Error | undefined>("error", undefined);
    this.refreshVersion = this.bridgeAtom<number>("refreshVersion", 0);

    this.autoDispose(
      effect(() => {
        this.filters.get();
        this.pagination.get();
        this.sorter.get();
        this.refreshVersion.get();
        if (this.page.mounted.get()) this.fetch();
      }),
    );
  }

  private async fetch(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const res = (await this.page.service(this.serviceCode, {
        ...this.serviceParams,
        filters: this.filters.get(),
        pagination: this.pagination.get(),
        sorter: this.sorter.get(),
      })) as ListResult;
      this.data.set(res.list ?? []);
      this.total.set(res.total ?? 0);
    } catch (e) {
      this.error.set(e as Error);
    } finally {
      this.loading.set(false);
    }
  }

  setFilterPatch(patch: Record<string, unknown>): void {
    this.store.batch(() => {
      const filters = { ...this.filters.get() };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) {
          delete filters[key];
        } else {
          filters[key] = value;
        }
      }
      this.filters.set(filters);
      this.pagination.set({ ...this.pagination.get(), current: 1 });
      this.refresh();
    });
  }

  refresh(): void {
    this.refreshVersion.set(this.refreshVersion.get() + 1);
  }
}
