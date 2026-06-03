export function getHandlerConfig<TConfig extends Record<string, unknown>>(ctx: { schema: any; key?: string }): TConfig {
  const xcms = ctx.schema?.['x-cms'];
  if (!xcms?.reactions) return {} as TConfig;
  const target = ctx.key ?? '';
  const config = xcms.reactions[target];
  return (config && typeof config === 'object' ? config : {}) as TConfig;
}
