import type { DataSourceItem } from "@alien-form/core";
import type { TranslatorPlugin } from "../compiler/types";
import type { PluginMarker } from "../dsl/marker";

export const DATA_SOURCE_PLUGIN = "$af-dataSource";

interface DataSourceMarker extends PluginMarker {
  model: string;
  service?: string;
  value?: string;
  label?: string;
}

function cacheKey(model: string, valueKey: string, labelKey: string): string {
  return `${DATA_SOURCE_PLUGIN}:${model}:${valueKey}:${labelKey}`;
}

export const dataSourcePlugin: TranslatorPlugin = {
  name: DATA_SOURCE_PLUGIN,
  order: 20,

  async prefetch(marker, ctx) {
    const ds = marker as DataSourceMarker;
    if (!ds.model) return;
    const valueKey = ds.value ?? "id";
    const labelKey = ds.label ?? valueKey;
    const key = cacheKey(ds.model, valueKey, labelKey);
    if (ctx.store[key]) return;

    const serviceCode = ds.service ?? "records.list";
    const service = ctx.runtime.registry.services.resolve(serviceCode, ctx.domain);
    if (!service) {
      throw new Error(`[alien-page] service "${serviceCode}" not registered for dataSource`);
    }

    const promise = service
      .send({ model: ds.model, pagination: { current: 1, pageSize: 1000 } }, { page: ctx.page ? { id: ctx.page.id } : undefined })
      .then((result) => result as { list: Record<string, unknown>[] })
      .then(({ list }) =>
        list.map<DataSourceItem>((item) => ({
          value: item[valueKey],
          label: String(item[labelKey] ?? item[valueKey] ?? ""),
        })),
      );

    ctx.store[key] = promise;
    await promise;
  },

  async resolve(marker, ctx) {
    const ds = marker as DataSourceMarker;
    if (!ds.model) return undefined;

    const valueKey = ds.value ?? "id";
    const labelKey = ds.label ?? valueKey;
    const cached = ctx.store[cacheKey(ds.model, valueKey, labelKey)] as
      | DataSourceItem[]
      | undefined;
    return cached ?? [];
  },
};
