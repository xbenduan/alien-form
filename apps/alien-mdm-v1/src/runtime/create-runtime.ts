import { Runtime, type BuilderSchema } from "@engine";
import { registerAll } from "../register";
import { schemaToColumns, schemaToFields } from "@utils/schema";
import { transport } from "./transport";

export function createAppRuntime(): Runtime {
  const runtime = new Runtime({ schemaToColumns, schemaToFields });
  registerAll(runtime, transport);
  runtime.useSchemaLoader((modelCode) =>
    transport.send<BuilderSchema>(`/api/schemas/${modelCode}`),
  );
  return runtime;
}

export const appRuntime = createAppRuntime();
