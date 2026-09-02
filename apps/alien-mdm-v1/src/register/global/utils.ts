import type { Runtime } from "@engine";
import { schemaToColumns, schemaToFilters } from "@utils/schema";

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns(runtime));
  runtime.utils("schemaToFilters", schemaToFilters(runtime));
}
