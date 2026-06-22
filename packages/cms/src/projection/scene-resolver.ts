import type {
  AdapterScene,
  SceneMode,
  AdapterCatalogItem,
  DefinedAdapter,
} from "../define/adapters";
import {
  createAdapterCatalog,
  getSceneVariant,
} from "../define/adapters";
import type { CmsFieldSchema } from "../types/schema";
import type { FilterOperator } from "../types/common";

export interface ResolvedSceneRender {
  /** 最终落地组件的 adapter key（消费端据此从 registry/map 取实际组件） */
  componentKey: string;
  mode: SceneMode;
  props: Record<string, unknown>;
  operator?: FilterOperator;
  summary?: boolean;
  trace: string[];
}

/** 场景默认渲染模式 */
export function defaultMode(scene: AdapterScene): SceneMode {
  switch (scene) {
    case "form":
      return "edit";
    case "filter":
      return "filter";
    case "detail":
      return "readonly";
    case "table":
      return "cell";
    case "builder":
      return "readonly";
  }
}

/** 场景到 x-cms meta key 的映射；builder 无对应 meta */
type SceneMetaKey = "form" | "detail" | "filter" | "table";

function sceneToMetaKey(scene: AdapterScene): SceneMetaKey | undefined {
  switch (scene) {
    case "form":
      return "form";
    case "detail":
      return "detail";
    case "filter":
      return "filter";
    case "table":
      return "table";
    case "builder":
      return undefined;
  }
}

/** 按 field.type 推导默认组件 key */
function defaultComponentByType(type: string | undefined): string | undefined {
  switch (type) {
    case "string":
      return "Input";
    case "number":
      return "NumberInput";
    case "boolean":
      return "Switch";
    case "array":
      return "ArrayCards";
    case "object":
    case "void":
      return "SectionCard";
    case "tags":
      return "TagsInput";
    default:
      return undefined;
  }
}

/** 安全读取某场景 meta 的 props（仅 filter meta 定义了 props，其余可选） */
function readMetaProps(
  field: CmsFieldSchema,
  scene: AdapterScene,
): Record<string, unknown> | undefined {
  const metaKey = sceneToMetaKey(scene);
  if (!metaKey) return undefined;
  const meta = field["x-cms"]?.[metaKey] as
    | { props?: Record<string, unknown> }
    | undefined;
  return meta?.props;
}

/**
 * 解析单个字段在指定场景下应渲染的组件与配置。
 * 返回 undefined 表示该字段不参与此场景（或无法推导组件）。
 */
export function resolveSceneRender(
  field: CmsFieldSchema,
  scene: AdapterScene,
  catalog: AdapterCatalogItem[],
): ResolvedSceneRender | undefined {
  const trace: string[] = [];

  // 1. 确定起始 componentKey
  let startKey = field.component;
  if (startKey) {
    trace.push(`start=${startKey} (field.component)`);
  } else {
    startKey = defaultComponentByType(field.type);
    if (!startKey) {
      return undefined;
    }
    trace.push(`start=${startKey} (type[${field.type ?? "?"}])`);
  }

  // 2. 在 catalog 中按 key 找到该 adapter
  const adapter = catalog.find((item) => item.key === startKey);
  if (!adapter) {
    return undefined;
  }

  // 3. 取该场景的 variant（字符串短语糖归一为 SceneVariant）
  const variant = getSceneVariant(adapter.scenes[scene]);
  if (!variant) {
    return undefined;
  }

  // 4. renderAs 一跳委托（不递归）
  let componentKey = startKey;
  if (variant.renderAs) {
    componentKey = variant.renderAs;
    trace.push(`${startKey} --renderAs[${scene}]--> ${variant.renderAs}`);
  }

  // 5. mode
  const mode = variant.mode ?? defaultMode(scene);

  // 6. props 三级合并（低→高）
  const props: Record<string, unknown> = {
    ...variant.props,
    ...field.props,
    ...readMetaProps(field, scene),
  };

  // 7. operator（仅 filter）
  let operator: FilterOperator | undefined;
  if (scene === "filter") {
    operator =
      (field["x-cms"]?.filter?.operator as FilterOperator | undefined) ??
      variant.operator;
  }

  // 8. summary（仅 table）
  let summary: boolean | undefined;
  if (scene === "table") {
    summary = field["x-cms"]?.table?.expandable ?? variant.summary;
  }

  return { componentKey, mode, props, operator, summary, trace };
}

/**
 * 生成指定场景的组件表。真实组件由 app 端通过 componentMap 注入；
 * 可选 wrap 用于注入 mode + 默认 props 的 HOC（cms 包不引入 React，故可选）。
 */
export function buildSceneComponents<TComponent>(
  scene: AdapterScene,
  catalog: AdapterCatalogItem[],
  componentMap: Record<string, TComponent>,
  wrap?: (
    component: TComponent,
    mode: SceneMode,
    props: Record<string, unknown>,
  ) => TComponent,
): Record<string, TComponent> {
  const result: Record<string, TComponent> = {};

  for (const item of catalog) {
    const variant = getSceneVariant(item.scenes[scene]);
    if (!variant) continue;

    const targetKey = variant.renderAs ?? item.key;
    const targetComponent = componentMap[targetKey];
    if (targetComponent === undefined) continue;

    const mode = variant.mode ?? defaultMode(scene);
    result[item.key] = wrap
      ? wrap(targetComponent, mode, variant.props ?? {})
      : targetComponent;
  }

  return result;
}

/**
 * 顶层 API：从 adapter 命名空间或字典派生 catalog/componentMap，
 * 内部调用 buildSceneComponents。
 *
 * 接受的 adapters 容器允许夹杂非 adapter 项（如 helper/options 等），
 * 内部自动过滤掉没有合法 `config.key` 的成员。
 */
export function buildScenes<TComponent = unknown>(
  adapters: Record<string, unknown>,
  scene: AdapterScene,
  wrap?: (
    component: TComponent,
    mode: SceneMode,
    props: Record<string, unknown>,
  ) => TComponent,
): Record<string, TComponent> {
  const filtered: Record<string, DefinedAdapter<any, any>> = {};
  const componentMap: Record<string, TComponent> = {};

  for (const [exportName, value] of Object.entries(adapters)) {
    if (typeof value !== "function") continue;
    const config = (value as { config?: { key?: unknown } }).config;
    if (!config || typeof config.key !== "string") continue;
    const key = config.key;
    if (Object.prototype.hasOwnProperty.call(filtered, key)) continue;
    filtered[key] = value as DefinedAdapter<any, any>;
    componentMap[key] = value as unknown as TComponent;
    void exportName;
  }

  const catalog = createAdapterCatalog(filtered as never);
  return buildSceneComponents(scene, catalog, componentMap, wrap);
}
