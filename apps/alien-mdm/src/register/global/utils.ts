import type { Runtime } from "@alien-form/engine";
import { message } from "antd";
import { schemaToColumns, schemaToFilters } from "@utils/schema";

function openRoute(path: string): void {
  window.open(`${window.location.origin}/records${path}`, "_self");
}

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns);
  runtime.utils("schemaToFilters", schemaToFilters);
  runtime.utils("message", message);
  runtime.utils("openRoute", openRoute);
}
