import type { ExpressionScope } from "@alien-form/core";
import type { RegistryNamespace } from "./namespace";

export interface Definition<TAuthoring = unknown> {
  code: string;
  title: string;
  description?: string;
  authoring: TAuthoring;
}

export interface UiDefinition<
  TComponent = unknown,
  TAuthoring = unknown,
> extends Definition<TAuthoring> {
  component: TComponent;
  blocks?: string[];
  slots?: string[];
}

export interface FormComponentDefinition<
  TComponent = unknown,
  TAuthoring = unknown,
> extends Definition<TAuthoring> {
  component: TComponent;
}

export interface FormDecoratorDefinition<
  TComponent = unknown,
  TAuthoring = unknown,
> extends Definition<TAuthoring> {
  component: TComponent;
}

export interface FormHandlerDefinition<TAuthoring = unknown> extends Definition<TAuthoring> {
  handler: (scope: ExpressionScope) => unknown | Promise<unknown>;
}

export interface ServiceContext {
  page?: { id: string };
  runtime?: unknown;
}

export interface ServiceDescriptor {
  code: string;
  send: (params?: unknown, ctx?: ServiceContext) => Promise<unknown>;
}

export interface FunctionDescriptor {
  code: string;
  handler: (...args: unknown[]) => unknown;
}

export interface FormRegistry {
  components: RegistryNamespace<FormComponentDefinition>;
  decorators: RegistryNamespace<FormDecoratorDefinition>;
  handlers: RegistryNamespace<FormHandlerDefinition>;
}

export interface Registry {
  ui: RegistryNamespace<UiDefinition>;
  services: RegistryNamespace<ServiceDescriptor>;
  functions: RegistryNamespace<FunctionDescriptor>;
  constants: RegistryNamespace<unknown>;
  form: FormRegistry;
}
