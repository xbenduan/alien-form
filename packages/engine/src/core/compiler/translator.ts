import { collectMarkers, deletePath, setPath } from "./walker";
import type { ResolveCtx, TranslateCtx, TranslatorPlugin } from "./types";
import type { PluginMarker } from "../dsl/marker";

export class SchemaTranslator {
  private pluginMap = new Map<string, TranslatorPlugin>();

  use(plugin: TranslatorPlugin): this {
    this.pluginMap.set(plugin.name, plugin);
    return this;
  }

  has(name: string): boolean {
    return this.pluginMap.has(name);
  }

  async translate<T>(input: T, ctx: TranslateCtx): Promise<T> {
    const cloned = structuredClone(input);
    const markers = collectMarkers(cloned);

    await this.prefetchAll(markers, ctx);
    await this.resolveAll(cloned, markers, ctx);

    return cloned;
  }

  private async prefetchAll(
    markers: { marker: PluginMarker; path: (string | number)[] }[],
    ctx: TranslateCtx,
  ): Promise<void> {
    await Promise.all(
      markers.map(async ({ marker }) => {
        const plugin = this.pluginMap.get(marker.plugin);
        if (plugin?.prefetch) {
          await plugin.prefetch(marker, ctx);
        }
      }),
    );
  }

  private async resolveAll(
    target: unknown,
    markers: { marker: PluginMarker; path: (string | number)[] }[],
    ctx: TranslateCtx,
  ): Promise<void> {
    const sorted = [...markers].sort((a, b) => {
      const oa = this.pluginMap.get(a.marker.plugin)?.order ?? 0;
      const ob = this.pluginMap.get(b.marker.plugin)?.order ?? 0;
      return oa - ob;
    });

    for (const { marker, path } of sorted) {
      const plugin = this.pluginMap.get(marker.plugin);
      if (!plugin) {
        deletePath(target, path);
        continue;
      }
      const resolveCtx: ResolveCtx = {
        ...ctx,
        path,
        patch: (p, v) => setPath(target, p, v),
      };
      const result = await plugin.resolve(marker, resolveCtx);
      if (result === undefined) {
        deletePath(target, path);
      } else {
        setPath(target, path, result);
      }
    }
  }
}
