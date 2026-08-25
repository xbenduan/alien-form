import type { Runtime } from "@alien-form/engine";
import { registerGlobal } from "./global";

export function registerAll(runtime: Runtime): void {
  registerGlobal(runtime);
}
