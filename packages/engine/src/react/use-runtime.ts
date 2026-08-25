import { useBlockContext, usePage, useRuntime } from "./context";
import { useAtom } from "./use-atom";
import type { BlockRuntime } from "../core/page/block";
import {
  FormBlockRuntime,
  ListBlockRuntime,
} from "../core/page/blocks";

export function useBlock(name?: string): BlockRuntime {
  const page = usePage();
  const contextBlock = useBlockContext();
  if (name) return page.block(name);
  if (contextBlock) return contextBlock;
  throw new Error("[alien-page] useBlock requires a block name or a BlockProvider ancestor");
}

export function useListBlock(name?: string) {
  const block = useBlock(name);
  if (!(block instanceof ListBlockRuntime)) {
    throw new Error(`[alien-page] block "${block.name}" is not a list block`);
  }
  return {
    data: useAtom(block.data),
    total: useAtom(block.total),
    loading: useAtom(block.loading),
    error: useAtom(block.error),
    filters: useAtom(block.filters),
    pagination: useAtom(block.pagination),
    sorter: useAtom(block.sorter),
    selection: useAtom(block.selection),
    refreshVersion: useAtom(block.refreshVersion),
    refresh: () => block.refresh(),
    setFilterPatch: (patch: Record<string, unknown>) => block.setFilterPatch(patch),
    setPagination: (p: { current: number; pageSize: number }) => block.pagination.set(p),
    setSorter: (s: { field: string; order: "asc" | "desc" } | undefined) => block.sorter.set(s),
    setSelection: (rows: unknown[]) => block.selection.set(rows),
  };
}

export function useFormBlock(name?: string) {
  const block = useBlock(name);
  if (!(block instanceof FormBlockRuntime)) {
    throw new Error(`[alien-page] block "${block.name}" is not a form block`);
  }
  return {
    form: block.form,
    values: useAtom(block.values),
    errors: useAtom(block.errors),
    valid: useAtom(block.valid),
    submitting: useAtom(block.submitting),
    setValue: (path: string, value: unknown) => block.setValue(path, value),
    setValues: (v: Record<string, unknown>) => block.setValues(v),
    submit: <T = unknown>() => block.submit<T>(),
    reset: () => block.reset(),
    validate: () => block.validate(),
  };
}

export function useService(code: string) {
  const runtime = useRuntime();
  const svc = runtime.registry.services.resolve(code);
  if (!svc) throw new Error(`[alien-page] service "${code}" not registered`);
  return svc;
}

export function useConstant<T = unknown>(key: string): T | undefined {
  const runtime = useRuntime();
  return runtime.registry.constants.resolve(key) as T | undefined;
}
