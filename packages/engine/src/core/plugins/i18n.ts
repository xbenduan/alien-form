import type { TranslatorPlugin } from "../compiler/types";
import type { PluginMarker } from "../dsl/marker";

export const I18N_PLUGIN = "$af-i18n";

interface I18nMarker extends PluginMarker {
  key: string;
  fallback?: string;
}

export const i18nPlugin: TranslatorPlugin = {
  name: I18N_PLUGIN,
  order: 10,
  resolve(marker, ctx) {
    const { key, fallback } = marker as I18nMarker;
    if (typeof key !== "string") return fallback ?? "";
    const pageValue = ctx.resources?.i18n?.[key]?.[ctx.locale];
    if (pageValue !== undefined) return pageValue;
    const dict = ctx.runtime.registry.constants.resolve("i18n", ctx.domain) as
      | Record<string, Record<string, string>>
      | undefined;
    return dict?.[key]?.[ctx.locale] ?? fallback ?? key;
  },
};
