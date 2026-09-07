import type { Runtime } from "@alien-form/engine";
import { message } from "antd";
import { openRoute } from "./navigation";
import { relation } from "./relation";
import { schemaToColumns, schemaToFilterFields } from "./schema";
import { tree } from "./tree";

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns);
  runtime.utils("schemaToFilterFields", schemaToFilterFields);
  runtime.utils("relation", relation);
  runtime.utils("tree", tree);
  runtime.utils("message", message);
  runtime.utils("openRoute", openRoute);
}
