import { Runtime } from "@alien-form/engine";
import { registerGlobal } from "./global";

export function getGlobalCapabilities() {
  const runtime = new Runtime();
  registerGlobal(runtime);
  return runtime.getCapabilities();
}
