import { createContext, createResource, onCleanup, useContext } from "solid-js";
import type { Accessor, Component } from "solid-js";
import { FormworkError, checkAbort } from "../model/errors";
import { modelDocumentSchema } from "../model/schema";
import { frameworkFormats, inferFormat, resolveFieldSchema, resolveModel } from "../model/field";
import { createRenderItem } from "../render/render";
import { createValueScope } from "../runtime/scope";
import type { FieldContainerProps } from "../runtime/types";
import type { FieldSchema, ModelDocument, Scene } from "../model/types";
import type { DataClient } from "../data/index";
import type {
  FormworkApplication,
  ModelContext,
  ModelOptions,
  PreparedField,
  SchemaContext,
} from "./types";

type Runtime = {
  app: FormworkApplication;
  data: DataClient;
  location: Accessor<{ pathname: string; search: string }>;
  navigate: (path: string, options?: { replace?: boolean; force?: boolean }) => void;
  confirm: (message: string) => Promise<boolean>;
  guard: (check: () => boolean) => () => void;
  outlets: Set<string>;
  portalTarget: Accessor<HTMLElement | undefined>;
};
export const RuntimeContext = createContext<Runtime>();
export const ModelProvider = createContext<ModelContext>();
export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new FormworkError("MISSING_FORMWORK", "请在 Formwork 内使用此能力");
  return runtime;
}
export function component(runtime: Runtime, name?: string): Component<any> {
  if (!name || !runtime.app.components[name])
    throw new FormworkError("MISSING_UI", `请在 app.ui 中映射并注册组件 ${name ?? "(未配置)"}`);
  return runtime.app.components[name]!;
}
const scenes: Scene[] = ["form", "filter", "table", "detail"];
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function prepare(document: ModelDocument, runtime: Runtime): SchemaContext["schema"] {
  const { ui } = runtime.app;
  const visit = (source: FieldSchema): PreparedField => {
    const field = resolveFieldSchema(source, document);
    const format = field.format ?? runtime.app.inferFormat?.(field) ?? inferFormat(field);
    const preset = runtime.app.formats?.[format] ?? frameworkFormats[format];
    const normalized = preset?.normalize?.(field) ?? field;
    const presentations = Object.fromEntries(
      scenes.map((scene) => {
        const provided = normalized.ui?.[scene];
        const selected = ui.selectField?.({ field: normalized, scene });
        const mapped =
          ui.formats?.[format]?.[scene] ?? selected ?? ui.types?.[normalized.type ?? ""]?.[scene];
        if (provided === false || (provided === undefined && mapped === false))
          return [scene, false];
        return [
          scene,
          {
            ...mapped,
            ...provided,
            props: { ...(mapped ? mapped.props : {}), ...(provided ? provided.props : {}) },
          },
        ];
      }),
    );
    return {
      ...normalized,
      ui: presentations as PreparedField["ui"],
      ...(normalized.properties
        ? {
            properties: Object.fromEntries(
              Object.entries(normalized.properties).map(([key, value]) => [key, visit(value)]),
            ),
          }
        : {}),
      ...(normalized.items ? { items: visit(normalized.items) } : {}),
      ...(normalized.additionalProperties
        ? { additionalProperties: visit(normalized.additionalProperties) }
        : {}),
    } as PreparedField;
  };
  const { $defs, ...body } = document;
  return {
    ...body,
    data: Object.fromEntries(
      Object.entries(document.data).map(([key, value]) => [key, visit(value)]),
    ),
    ...($defs
      ? {
          $defs: Object.fromEntries(
            Object.entries($defs).map(([key, value]) => [key, visit(value)]),
          ),
        }
      : {}),
  };
}
export async function loadModel(
  runtime: Runtime,
  options: ModelOptions & { modelId: string },
  signal: AbortSignal,
  inherited?: ModelContext,
): Promise<ModelContext> {
  const domain = options.router
    ? runtime.app.domains.find((entry) => entry.router === options.router)
    : undefined;
  if (options.router && !domain)
    throw new FormworkError("UNKNOWN_DOMAIN", `未注册 Domain ${options.router}`);
  const reuse = inherited?.modelId === options.modelId && inherited.router === options.router;
  if (reuse && !options.transformSchema) return inherited;
  const snapshot = reuse
    ? inherited.snapshot
    : await runtime.data.getModel({ modelId: options.modelId }, { signal });
  checkAbort(signal);
  const source = freeze(structuredClone(snapshot.schema));
  resolveModel(source, runtime.app, snapshot.capabilities);
  let context: SchemaContext = {
    modelId: options.modelId,
    router: options.router,
    sourceSchema: source,
    signal,
    schema: reuse ? structuredClone(inherited.schema) : prepare(structuredClone(source), runtime),
  };
  const hooks = [
    ...(!reuse
      ? ([
          ["app", runtime.app.transformSchema],
          ["domain", domain?.transformSchema],
        ] as const)
      : []),
    ["local", options.transformSchema] as const,
  ];
  for (const [name, transform] of hooks) {
    if (!transform) continue;
    const result = await transform(context);
    checkAbort(signal);
    if (result !== context)
      throw new FormworkError("INVALID_TRANSFORM", `${name}.transformSchema 必须返回传入的 ctx`);
    const parsed = modelDocumentSchema.safeParse(context.schema, { jitless: true });
    if (!parsed.success || context.schema.id !== options.modelId)
      throw new FormworkError("INVALID_TRANSFORM", `${name}.transformSchema 返回了非法模型`);
    // 后续 hook 始终拿到已初始化的四种场景。
    context = { ...context, schema: prepare(context.schema, runtime) };
  }
  const model = resolveModel(context.schema, runtime.app, snapshot.capabilities);
  const RenderItem = createRenderItem({
    model,
    components: runtime.app.components,
    fieldContainer: runtime.app.ui.fieldContainer
      ? (component(runtime, runtime.app.ui.fieldContainer) as Component<FieldContainerProps>)
      : undefined,
    scope: () => {
      throw new FormworkError("MISSING_SCOPE", "请显式传入字段 scope");
    },
  });
  return {
    ...context,
    snapshot,
    model,
    data: runtime.data,
    RenderItem,
    createScope: (options = {}) =>
      createValueScope(
        {
          ...options,
          validate: async (value, control) => [
            ...model.validateFormats(value),
            ...((await options.validate?.(value, control)) ?? []),
          ],
        },
        model.valueSchema,
      ),
  };
}
export function createModelResource(options: Accessor<ModelOptions>) {
  const runtime = useRuntime();
  const inherited = useContext(ModelProvider);
  let pending: AbortController | undefined;
  onCleanup(() => pending?.abort());
  return createResource<ModelContext, ModelOptions & { modelId: string }>(
    () => {
      const input = options();
      const modelId = input.modelId ?? inherited?.modelId;
      if (!modelId) throw new FormworkError("MODEL_REQUIRED", "普通 Page 内必须提供 modelId");
      const router =
        input.router ?? (modelId === inherited?.modelId ? inherited.router : undefined);
      return { ...input, modelId, router };
    },
    (input, { refetching }) => {
      pending?.abort();
      pending = new AbortController();
      if (
        !refetching &&
        inherited?.modelId === input.modelId &&
        inherited.router === input.router &&
        !input.transformSchema
      )
        return inherited;
      return loadModel(runtime, input, pending.signal, refetching ? undefined : inherited);
    },
  );
}
