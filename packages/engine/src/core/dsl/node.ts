import type { IFormSchema } from "@alien-form/core";
import type { PluginMarker } from "./marker";

export interface UiNode {
  component: string;
  props?: Record<string, unknown>;
  children?: UiNode[];
  slots?: Record<string, UiNode[]>;
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
  /** 页面实例标识，用于 runtime 生命周期与 store 隔离。 */
  id: string;
  /** 注册域，组件/表单处理器优先从该 domain 解析，再回退 global。 */
  domain: string;
  title?: string;
  /** 页面级元信息（如 openMode、标签），运行时不解释，透传给注册组件消费。 */
  meta?: Record<string, unknown>;
  blocks: BlockSchema[];
  layout: UiNode;
}

export interface CompiledPage {
  layout: UiNode;
  blockOutputs: Record<string, unknown>;
}
