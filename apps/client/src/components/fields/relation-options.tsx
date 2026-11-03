import { createContext, createSignal, onCleanup, useContext } from "solid-js";
import type { Component, JSX } from "solid-js";
import type {
  EnumOption,
  FieldDescriptor,
  RelationOptionsInput,
  RelationOptionsResult,
} from "formwork";

type Atom = string | number | boolean;
type RelationService = {
  label: (field: FieldDescriptor, value: Atom) => string | undefined;
  ensure: (field: FieldDescriptor, values: readonly Atom[]) => void;
  search: (field: FieldDescriptor, keyword: string, signal: AbortSignal) => Promise<EnumOption[]>;
  error: (field: FieldDescriptor) => string | undefined;
  retry: (field: FieldDescriptor) => void;
};
const Context = createContext<RelationService>();
const key = (value: Atom) => JSON.stringify(value);

/** 为同一记录页面缓存关系标签，合并同轮单元格回显并以最多 200 个值分批查询。 */
export const RelationOptions: Component<{
  load: (input: RelationOptionsInput, signal: AbortSignal) => Promise<RelationOptionsResult>;
  signal: AbortSignal;
  children?: JSX.Element;
}> = (props) => {
  const cache = new Map<string, Map<string, string>>();
  const requested = new Map<string, Set<string>>();
  const pending = new Map<FieldDescriptor, Atom[]>();
  const errors = new Map<string, string>();
  const failed = new Map<string, Atom[]>();
  const [version, setVersion] = createSignal(0);
  const lifetime = new AbortController();
  const signal = AbortSignal.any([lifetime.signal, props.signal]);
  onCleanup(() => lifetime.abort());
  let scheduled = false;
  const remember = (field: FieldDescriptor, options: readonly EnumOption[]) => {
    const labels = cache.get(field.path) ?? new Map<string, string>();
    for (const option of options)
      if (option.value !== null) labels.set(key(option.value), option.label);
    cache.set(field.path, labels);
    setVersion((value) => value + 1);
  };
  const flush = async () => {
    scheduled = false;
    const batch = [...pending];
    pending.clear();
    for (const [field, values] of batch) {
      for (let offset = 0; offset < values.length; offset += 200) {
        if (signal.aborted) return;
        try {
          const result = await props.load(
            {
              fieldId: field.path,
              selectedValues: values.slice(offset, offset + 200),
            },
            signal,
          );
          if (!signal.aborted) {
            errors.delete(field.path);
            remember(field, result.options);
          }
        } catch (error) {
          if (!signal.aborted) {
            errors.set(field.path, error instanceof Error ? error.message : String(error));
            failed.set(field.path, [
              ...(failed.get(field.path) ?? []),
              ...values.slice(offset, offset + 200),
            ]);
            setVersion((value) => value + 1);
          }
        }
      }
    }
  };
  const service: RelationService = {
    label(field, value) {
      version();
      return cache.get(field.path)?.get(key(value));
    },
    error(field) {
      version();
      return errors.get(field.path);
    },
    retry(field) {
      const values = failed.get(field.path) ?? [];
      failed.delete(field.path);
      for (const value of values) requested.get(field.path)?.delete(key(value));
      service.ensure(field, values);
    },
    ensure(field, values) {
      const seen = requested.get(field.path) ?? new Set<string>();
      const fresh = values.filter((value) => {
        if (seen.has(key(value))) return false;
        seen.add(key(value));
        return true;
      });
      requested.set(field.path, seen);
      if (!fresh.length) return;
      pending.set(field, [...(pending.get(field) ?? []), ...fresh]);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => void flush());
      }
    },
    async search(field, keyword, requestSignal) {
      const result = await props.load(
        { fieldId: field.path, keyword, limit: 100 },
        AbortSignal.any([signal, requestSignal]),
      );
      if (!signal.aborted && !requestSignal.aborted) {
        errors.delete(field.path);
        remember(field, result.options);
      }
      return result.options;
    },
  };
  return <Context.Provider value={service}>{props.children}</Context.Provider>;
};

/** 获取当前页面的关系服务，不创建跨账号或跨实例的共享缓存。 */
export function useRelationOptions() {
  return useContext(Context);
}
