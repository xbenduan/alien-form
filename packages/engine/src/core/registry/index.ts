import { RegistryNamespace } from "./namespace";
import type {
  ComponentDescriptor,
  FormRegistry,
  FunctionDescriptor,
  Registry,
  ServiceDescriptor,
} from "./types";

export function createRegistry(): Registry {
  return {
    components: new RegistryNamespace<ComponentDescriptor>(),
    services: new RegistryNamespace<ServiceDescriptor>(),
    functions: new RegistryNamespace<FunctionDescriptor>(),
    constants: new RegistryNamespace<unknown>(),
    form: {
      components: new RegistryNamespace<unknown>(),
      decorators: new RegistryNamespace<unknown>(),
      handlers: new RegistryNamespace(),
    } satisfies FormRegistry,
  };
}

export { RegistryNamespace } from "./namespace";
export type {
  ComponentDescriptor,
  FormRegistry,
  FunctionDescriptor,
  Registry,
  ServiceContext,
  ServiceDescriptor,
} from "./types";
