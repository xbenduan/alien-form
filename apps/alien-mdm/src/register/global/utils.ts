import type { Runtime } from "@alien-form/engine";
import { message } from "antd";
import { schemaToColumns, schemaToFilters } from "@utils/schema";

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns(runtime));
  runtime.utils("schemaToFilters", schemaToFilters(runtime));
  runtime.utils("message", message);
}
