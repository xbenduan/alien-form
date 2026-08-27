import { RegistryNamespace } from "./namespace";
import type {
  FormComponentDefinition,
  FormDecoratorDefinition,
  FormHandlerDefinition,
  FormRegistry,
  FunctionDescriptor,
  Registry,
  ServiceDescriptor,
  UiDefinition,
} from "./types";

export function createRegistry(): Registry {
  return {
    ui: new RegistryNamespace<UiDefinition>(),
    services: new RegistryNamespace<ServiceDescriptor>(),
    functions: new RegistryNamespace<FunctionDescriptor>(),
    constants: new RegistryNamespace<unknown>(),
    form: {
      components: new RegistryNamespace<FormComponentDefinition>(),
      decorators: new RegistryNamespace<FormDecoratorDefinition>(),
      handlers: new RegistryNamespace<FormHandlerDefinition>(),
    } satisfies FormRegistry,
  };
}

export { RegistryNamespace } from "./namespace";
export type {
  Definition,
  FormComponentDefinition,
  FormDecoratorDefinition,
  FormHandlerDefinition,
  FormRegistry,
  FunctionDescriptor,
  Registry,
  ServiceContext,
  ServiceDescriptor,
  UiDefinition,
} from "./types";
