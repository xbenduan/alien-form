import type { DataSourceItem } from "@alien-form/react";
import type {
  AlienPlugin,
  FieldService,
  PluginMarker,
  PrefetchCtx,
  ResolveCtx,
} from "./types";

// ─── $af-i18n：多语言文案替换（同步，scene 无关）─────────────────────────────

export const I18N_PLUGIN = "$af-i18n";

/** i18n marker：{ plugin, key, fallback? }。 */
export const i18nPlugin: AlienPlugin = {
  name: I18N_PLUGIN,
  order: 10,
  resolve: (marker, ctx) => {
    const key = typeof marker.key === "string" ? marker.key : "";
    const fallback = typeof marker.fallback === "string" ? marker.fallback : key;
    const dict = ctx.schema.i18n?.[key];
    return dict?.[ctx.locale] ?? fallback;
  },
};

// ─── $af-dataSource：外键选项加载（handler 预取 / props 组件自取双方案）────────

export const DATA_SOURCE_PLUGIN = "$af-dataSource";

/** 远程数据量超过此阈值时，props 方案走组件远程搜索而非前端过滤。 */
const REMOTE_SEARCH_THRESHOLD = 50;

interface DataSourceMarker extends PluginMarker {
  model: string;
  value?: string;
  label?: string;
  /** handler：编译期预取选项写入 dataSource；props：注入 props.service 由组件自取。默认 props。 */
  mode?: "handler" | "props";
}

function cacheKey(model: string, valueKey: string, labelKey: string): string {
  return `${DATA_SOURCE_PLUGIN}:${model}:${valueKey}:${labelKey}`;
}

/**
 * 预取一次外键选项，缓存在 ctx.store（按 model/value/label 去重），供 table / filter
 * 翻译外键与 form handler 方案共用。resolveData=false 时跳过（构建器预览）。
 */
async function prefetchOptions(marker: PluginMarker, ctx: PrefetchCtx): Promise<void> {
  const ds = marker as DataSourceMarker;
  if (!ctx.resolveData || !ds.model) return;
  const valueKey = ds.value || "id";
  const labelKey = ds.label || valueKey;
  const key = cacheKey(ds.model, valueKey, labelKey);
  if (ctx.store[key]) return;

  const promise = ctx
    .request({ model: ds.model, pagination: { current: 1, pageSize: 1000 } })
    .then(({ list }) =>
      list.map<DataSourceItem>((item) => ({
        value: item[valueKey],
        label: String(item[labelKey] ?? item[valueKey] ?? ""),
      })),
    );
  ctx.store[key] = promise;
  await promise;
}

async function readOptions(marker: DataSourceMarker, ctx: ResolveCtx): Promise<DataSourceItem[]> {
  const valueKey = marker.value || "id";
  const labelKey = marker.label || valueKey;
  const cached = ctx.store[cacheKey(marker.model, valueKey, labelKey)];
  if (!cached) return [];
  return (await cached) as DataSourceItem[];
}

/**
 * dataSource marker：{ plugin, model, value?, label?, mode? }。
 *  - table / filter 场景：始终用预取选项翻译外键（无表单运行时，必须预取）。
 *  - form 场景 handler 方案：写入预取选项到 dataSource。
 *  - form 场景 props 方案：清空 dataSource，注入 props.service 交组件自取。
 */
export const dataSourcePlugin: AlienPlugin = {
  name: DATA_SOURCE_PLUGIN,
  order: 20,
  prefetch: prefetchOptions,
  resolve: async (marker, ctx) => {
    const ds = marker as DataSourceMarker;
    if (!ds.model) return undefined;
    const options = await readOptions(ds, ctx);
    const mode = ds.mode ?? "props";

    // table / filter：始终注入选项数组（翻译外键）
    if (ctx.scene !== "form") return options;

    // form + handler：预取选项直接落 dataSource
    if (mode === "handler") return options;

    // form + props：组件自取，注入声明式 service，dataSource 置空
    const fieldPath = ctx.path.slice(0, -1);
    const service: FieldService = {
      model: ds.model,
      valueKey: ds.value || "id",
      labelKey: ds.label || (ds.value || "id"),
      remoteSearch: options.length > REMOTE_SEARCH_THRESHOLD,
    };
    ctx.patch([...fieldPath, "props", "service"], service);
    return undefined;
  },
};

export const builtinPlugins: AlienPlugin[] = [i18nPlugin, dataSourcePlugin];
