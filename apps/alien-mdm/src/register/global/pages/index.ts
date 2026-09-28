import { defineComponent, type Runtime } from "@alien-form/engine";
import { RecordForm } from "./record-form";
import { Overlay } from "../ui/overlay";

export function registerPages(runtime: Runtime): void {
  runtime.component("record-form", defineComponent(RecordForm, { injectContext: true }));
  runtime.component("overlay", defineComponent(Overlay, { injectContext: true }));
}
