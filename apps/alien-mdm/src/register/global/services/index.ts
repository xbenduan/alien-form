import type { Runtime } from "@alien-form/engine";
import { registerAuthServices } from "./auth";
import { registerModelServices } from "./model";
import { registerRecordServices } from "./record";

export function registerServices(runtime: Runtime): void {
  registerAuthServices(runtime);
  registerModelServices(runtime);
  registerRecordServices(runtime);
}
