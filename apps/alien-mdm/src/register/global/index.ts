import type { Runtime } from "@alien-form/engine";
import { registerUIComponents } from "./ui";
import { registerPageComponents } from "./pages";
import { registerFormComponents } from "./form";
import { registerConstant } from "./constant";

export function registerGlobal(runtime: Runtime): void {
  registerUIComponents(runtime);
  registerPageComponents(runtime);
  registerFormComponents(runtime);
  registerConstant(runtime);
}
