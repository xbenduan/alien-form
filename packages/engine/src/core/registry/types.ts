import type { RuntimeRuleHandler } from "@alien-form/core";
import type { RegistryNamespace } from "./namespace";

export interface ComponentDescriptor<TComponent = unknown> {
  component: TComponent;
  blocks?: string[];
  slots?: string[];
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
  components: RegistryNamespace<unknown>;
  decorators: RegistryNamespace<unknown>;
  handlers: RegistryNamespace<RuntimeRuleHandler>;
}

export interface Registry {
  components: RegistryNamespace<ComponentDescriptor>;
  services: RegistryNamespace<ServiceDescriptor>;
  functions: RegistryNamespace<FunctionDescriptor>;
  constants: RegistryNamespace<unknown>;
  form: FormRegistry;
}
