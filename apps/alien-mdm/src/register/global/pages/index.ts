import { defineComponent, type Runtime } from "@alien-form/engine";
import { RecordForm } from "./record-form";
import { Overlay } from "../ui/overlay";
import { RecordPage } from "../ui/record-page";

export function registerPages(runtime: Runtime): void {
  runtime.component("record-page", defineComponent(RecordPage, { injectContext: true }));
  runtime.component("record-form", defineComponent(RecordForm, { injectContext: true }));
  runtime.component("overlay", defineComponent(Overlay, { injectContext: true }));
}
