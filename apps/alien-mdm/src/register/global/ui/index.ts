import type { Runtime } from "@alien-form/engine";
import { uiDefinitions } from "./registry";

export function registerUIComponents(runtime: Runtime): void {
  for (const definition of Object.values(uiDefinitions)) {
    runtime.ui(definition);
  }
}
