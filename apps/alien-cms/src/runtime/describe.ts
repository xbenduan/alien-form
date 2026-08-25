import type React from "react";
import type { RuntimeRuleHandler } from "@alien-form/core";
import type { AfUiNode, LayoutServiceMap } from "@alien-form/shared";
import type { RuntimeCore } from "./RuntimeCore";
import { DataScope } from "./DataScope";

export type { AfUiNode };

export interface ServiceDescribe {
  code: string;
  send: (params?: unknown, options?: unknown) => Promise<unknown>;
}

export interface UIComponentDescribe {
  Component: React.ComponentType<UINodeProps>;
}

export interface UINodeProps {
  props: Record<string, unknown>;
  children: AfUiNode[];
  slots: Record<string, AfUiNode[]>;
  ctx: PageContext;
}

/**
 * 布局 service 解析所需的最小上下文。
 * PageContext 满足该契约；动作页等无完整布局的场景也可构造瘦 ctx 复用 hooks。
 */
export interface ServiceCtx {
  model: string;
  runtime: RuntimeCore;
  services: LayoutServiceMap;
  scope?: DataScope;
}

export interface PageContext extends ServiceCtx {
  schema: Record<string, unknown>;
  compiled: Record<string, unknown>;
  page: unknown;
}

export interface RegisterDescribe {
  ui?: Record<string, UIComponentDescribe>;
  services?: ServiceDescribe[];
  constant?: Record<string, unknown>;
  form?: {
    components?: Record<string, unknown>;
    decorators?: Record<string, unknown>;
    handlers?: Record<string, RuntimeRuleHandler>;
  };
}

export type IConfig = (runtime: RuntimeCore) => RegisterDescribe;
