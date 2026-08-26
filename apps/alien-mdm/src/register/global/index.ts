import type { Runtime } from "@alien-form/engine";
import { registerUIComponents } from "./ui";
import { registerFormComponents } from "./form";
import { registerConstant } from "./constant";

export function registerGlobal(runtime: Runtime): void {
  registerUIComponents(runtime);
  registerFormComponents(runtime);
  registerConstant(runtime);
}
