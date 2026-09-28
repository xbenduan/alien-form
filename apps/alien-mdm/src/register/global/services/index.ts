import type { Runtime } from "@alien-form/engine";
import { registerModelServices } from "./model";
import { registerRecordServices } from "./record";

export function registerServices(runtime: Runtime): void {
  registerModelServices(runtime);
  registerRecordServices(runtime);
}
