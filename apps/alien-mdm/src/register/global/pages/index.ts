import type { Runtime } from "@alien-form/engine";
import { Overlay } from "./overlay";
import { RecordForm } from "./record-form";
import { RecordPage } from "./record-page";

export function registerPages(runtime: Runtime): void {
  runtime.component({ code: "record-page", component: RecordPage, adapter: "page" });
  runtime.component({ code: "record-form", component: RecordForm, adapter: "page" });
  runtime.component({ code: "overlay", component: Overlay, adapter: "page" });
}
