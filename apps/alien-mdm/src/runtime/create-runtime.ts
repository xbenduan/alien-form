import { Runtime, type AlienSchema } from "@alien-form/engine";
import { parseAlienSchema } from "@alien-form/protocol";
import { registerAll } from "../register";
import { coalesceRequest } from "./request-coalescer";
import { sdkClient } from "./sdk-client";

export function createAppRuntime(): Runtime {
  const runtime = new Runtime();
  const pendingModels = new Map<string, Promise<AlienSchema>>();
  registerAll(runtime);
  runtime.useSchemaLoader((modelCode) =>
    coalesceRequest(pendingModels, modelCode, async () =>
      parseAlienSchema(await sdkClient.models.get(modelCode)),
    ),
  );
  return runtime;
}

export const appRuntime = createAppRuntime();
