import { Runtime, type BuilderSchema } from "@alien-form/engine";
import { registerAll } from "../register";
import { coalesceRequest } from "./request-coalescer";
import { transport } from "./transport";

export function createAppRuntime(): Runtime {
  const runtime = new Runtime();
  const pendingModels = new Map<string, Promise<BuilderSchema>>();
  registerAll(runtime);
  runtime.useSchemaLoader((modelCode) =>
    coalesceRequest(pendingModels, modelCode, () =>
      transport.send<BuilderSchema>(`/api/schemas/${modelCode}`),
    ),
  );
  return runtime;
}

export const appRuntime = createAppRuntime();
