import type { Runtime } from "@alien-form/engine";
import { RecordForm } from "./record-form";
import { Overlay } from "../ui/overlay";
import { RecordPage } from "../ui/record-page";

export function registerPages(runtime: Runtime): void {
  runtime.component({ code: "record-page", component: RecordPage, adapter: "page" });
  runtime.component({ code: "record-form", component: RecordForm, adapter: "page" });
  runtime.component({ code: "overlay", component: Overlay, adapter: "page" });
}
