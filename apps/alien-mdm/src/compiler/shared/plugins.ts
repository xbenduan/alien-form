import type { AlienPlugin, PluginMarker } from "./types";

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

export const CONSTANT_PLUGIN = "$af-constant";

interface ConstantMarker extends PluginMarker {
  key: string;
}

export const constantPlugin: AlienPlugin = {
  name: CONSTANT_PLUGIN,
  order: 5,
  resolve: (marker, ctx) => {
    const key = (marker as ConstantMarker).key;
    return ctx.constant(key);
  },
};

export const builtinPlugins: AlienPlugin[] = [constantPlugin, i18nPlugin];
