import type { IFormSchema } from "@alien-form/core";
import type { PluginMarker } from "./marker";

export interface UiNode {
  component: string;
  props?: Record<string, unknown>;
  children?: UiNode[];
  slots?: Record<string, UiNode>;
  block?: string;
  visible?: string;
}

export type BlockType = "list" | "form" | "detail" | "custom";

export interface BlockSchema {
  name: string;
  type: BlockType;
  service?: string;
  params?: Record<string, unknown>;
  pagination?: { current: number; pageSize: number };
  initialState?: Record<string, unknown>;
  formSchema?: IFormSchema | PluginMarker;
  columns?: unknown[] | PluginMarker;
}

export interface PageSchema {
  /** 逻辑页面标识，用于路由和 React 重挂载；运行时隔离由 PageRuntime.instanceId 负责。 */
  id: string;
  /** 注册域，组件/表单处理器优先从该 domain 解析，再回退 global。 */
  domain: string;
  title?: string;
  /** 页面级元信息（如 openMode、标签），运行时不解释，透传给注册组件消费。 */
  meta?: Record<string, unknown>;
  resources?: {
    i18n?: Record<string, Record<string, string>>;
    constants?: Record<string, unknown>;
  };
  blocks: BlockSchema[];
  layout: UiNode;
}

export interface CompiledPage {
  schema: PageSchema;
  layout: UiNode;
  blockOutputs: Record<string, unknown>;
}
