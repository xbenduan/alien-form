import { Runtime, type ModelSchema } from "@alien-form/engine";
import { parseModelSchema } from "@alien-form/protocol";
import { registerAll } from "../register";
import { coalesceRequest } from "./request-coalescer";
import { transport } from "./transport";

export function createAppRuntime(): Runtime {
  const runtime = new Runtime();
  const pendingModels = new Map<string, Promise<ModelSchema>>();
  registerAll(runtime);
  runtime.useSchemaLoader((modelCode) =>
    coalesceRequest(pendingModels, modelCode, async () =>
      parseModelSchema(await transport.send<unknown>(`/api/v1/models/${modelCode}`)),
    ),
  );
  return runtime;
}

export const appRuntime = createAppRuntime();
