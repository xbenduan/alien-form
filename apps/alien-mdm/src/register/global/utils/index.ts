import type { Runtime } from "@alien-form/engine";
import { message } from "antd";
import { schemaToColumns, schemaToFilters } from "@utils/schema";
import { openRoute } from "./navigation";
import { relation } from "./relation";
import { tree } from "./tree";

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns);
  runtime.utils("schemaToFilters", schemaToFilters);
  runtime.utils("relation", relation);
  runtime.utils("tree", tree);
  runtime.utils("message", message);
  runtime.utils("openRoute", openRoute);
}
