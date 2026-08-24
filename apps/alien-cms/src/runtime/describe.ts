import type React from "react";
import type { RuntimeRuleHandler } from "@alien-form/core";
import type { AfUiNode } from "@alien-form/shared";
import type { RuntimeCore } from "./RuntimeCore";

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

export interface PageContext {
  model: string;
  schema: Record<string, unknown>;
  compiled: Record<string, unknown>;
  runtime: RuntimeCore;
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
