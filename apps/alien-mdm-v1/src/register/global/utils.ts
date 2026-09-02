import type { Runtime } from "@engine";
import { schemaToColumns, schemaToFields } from "@utils/schema";

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns(runtime));
  runtime.utils("schemaToFields", schemaToFields);
}
