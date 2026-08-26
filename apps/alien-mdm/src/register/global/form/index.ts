import type { Runtime } from "@alien-form/engine";
import { fieldComponents } from "./registry";
import { FormItem, FilterItem } from "@components/decorators";

export function registerFormComponents(runtime: Runtime): void {
  for (const [name, component] of Object.entries(fieldComponents)) {
    runtime.formComponent(name, component);
  }
  runtime.formDecorator("FormItem", FormItem);
  runtime.formDecorator("FilterItem", FilterItem);
}
