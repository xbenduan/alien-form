import { Runtime } from "./runtime";

export { Runtime } from "./runtime";
export type { RuntimeOptions } from "./runtime";

export function createRuntime(options?: ConstructorParameters<typeof Runtime>[0]): Runtime {
  return new Runtime(options);
}
