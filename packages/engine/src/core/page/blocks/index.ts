import type { AtomStore } from "../../store/atom";
import type { BlockSchema } from "../../dsl";
import type { PageRuntime } from "../runtime";
import type { Runtime } from "../../runtime/runtime";
import { BlockRuntime } from "../block";
import { ListBlockRuntime } from "./list";
import { FormBlockRuntime } from "./form";
import { DetailBlockRuntime } from "./detail";
import { CustomBlockRuntime } from "./custom";

export function createBlock(
  schema: BlockSchema,
  page: PageRuntime,
  store: AtomStore,
  runtime: Runtime,
  output?: unknown,
): BlockRuntime {
  switch (schema.type) {
    case "list":
      return new ListBlockRuntime(schema, page, store, runtime);
    case "form":
      return new FormBlockRuntime(schema, page, store, runtime, output);
    case "detail":
      return new DetailBlockRuntime(schema, page, store, runtime, output);
    case "custom":
      return new CustomBlockRuntime(schema, page, store, runtime);
    default:
      throw new Error(`[alien-page] unknown block type: ${schema.type}`);
  }
}

export { BlockRuntime } from "../block";
export { ListBlockRuntime } from "./list";
export { FormBlockRuntime } from "./form";
export { DetailBlockRuntime } from "./detail";
export { CustomBlockRuntime } from "./custom";
