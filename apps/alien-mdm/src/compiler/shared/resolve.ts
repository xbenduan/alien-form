import type {
  AlienPlugin,
  Locale,
  ModelSchema,
  PluginMarker,
  PrefetchCtx,
  ResolveCtx,
  Scene,
} from "./types";
import { collectMarkers, deletePath, setPath } from "./utils/deep-path";

function pluginMap(plugins: AlienPlugin[]): Map<string, AlienPlugin> {
  const map = new Map<string, AlienPlugin>();
  // 后注册覆盖同名
  for (const plugin of plugins) map.set(plugin.name, plugin);
  return map;
}

interface SharedResolveState {
  locale: Locale;
  resolveData: boolean;
  service: PrefetchCtx["service"];
  constant: PrefetchCtx["constant"];
  store: Record<string, unknown>;
}

/**
 * 预取阶段：跨场景只做一次。遍历原始 schema 找出所有 marker，
 * 并发触发各插件 prefetch，把远程结果灌进共享 store。
 */
export async function prefetch(
  schema: ModelSchema,
  plugins: AlienPlugin[],
  ctx: PrefetchCtx,
): Promise<void> {
  const map = pluginMap(plugins);
  const markers = collectMarkers(schema);
  await Promise.all(
    markers.map(({ marker }) => {
      const plugin = map.get(marker.plugin);
      return plugin?.prefetch ? plugin.prefetch(marker, ctx) : Promise.resolve();
    }),
  );
}

/**
 * resolve 阶段：对某个场景的 ModelSchema 副本，遍历所有 marker，按 plugin 派发；
 * 用 resolve 返回值替换 marker 所在位置（返回 undefined 表示删除该位置的键，
 * 通常配合 ctx.patch 在别处写入，如 props 方案的 props.service）。
 * marker 按插件 order 升序执行。
 */
export async function resolveScene(
  sceneSchema: ModelSchema,
  scene: Scene,
  rawSchema: ModelSchema,
  plugins: AlienPlugin[],
  shared: SharedResolveState,
): Promise<ModelSchema> {
  const map = pluginMap(plugins);
  const markers = collectMarkers(sceneSchema).sort(
    (a, b) => (map.get(a.marker.plugin)?.order ?? 0) - (map.get(b.marker.plugin)?.order ?? 0),
  );

  for (const { marker, path } of markers) {
    const plugin = map.get(marker.plugin);
    // 未注册插件：删除 marker，避免把 { plugin } 对象泄漏进渲染
    if (!plugin) {
      deletePath(sceneSchema, path);
      continue;
    }
    const ctx: ResolveCtx = {
      schema: rawSchema,
      scene,
      path,
      locale: shared.locale,
      resolveData: shared.resolveData,
      service: shared.service,
      constant: shared.constant,
      store: shared.store,
      patch: (target, value) => setPath(sceneSchema, target, value),
    };
    const result = await plugin.resolve(marker as PluginMarker, ctx);
    if (result === undefined) deletePath(sceneSchema, path);
    else setPath(sceneSchema, path, result);
  }

  return sceneSchema;
}
