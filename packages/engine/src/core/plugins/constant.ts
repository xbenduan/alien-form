import type { TranslatorPlugin } from "../compiler/types";
import type { PluginMarker } from "../dsl/marker";

export const CONSTANT_PLUGIN = "$af-constant";

interface ConstantMarker extends PluginMarker {
  key: string;
}

export const constantPlugin: TranslatorPlugin = {
  name: CONSTANT_PLUGIN,
  order: 5,
  resolve(marker, ctx) {
    const { key } = marker as ConstantMarker;
    return ctx.runtime.registry.constants.resolve(key);
  },
};
