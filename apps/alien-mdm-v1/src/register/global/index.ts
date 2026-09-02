import type { Runtime } from "@engine";
import type { Transport } from "@runtime/transport";
import { registerComponents } from "./components";
import { registerEnums } from "./enums";
import { registerServices } from "./services";
import { registerUtils } from "./utils";

export function registerGlobal(runtime: Runtime, transport: Transport): void {
  registerComponents(runtime);
  registerServices(runtime, transport);
  registerEnums(runtime);
  registerUtils(runtime);
}
