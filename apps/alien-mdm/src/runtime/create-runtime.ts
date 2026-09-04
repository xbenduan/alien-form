import { Runtime, type BuilderSchema } from "@alien-form/engine";
import { registerAll } from "../register";
import { transport } from "./transport";

export function createAppRuntime(): Runtime {
  const runtime = new Runtime();
  registerAll(runtime);
  runtime.useSchemaLoader((modelCode) =>
    transport.send<BuilderSchema>(`/api/schemas/${modelCode}`),
  );
  return runtime;
}

export const appRuntime = createAppRuntime();
