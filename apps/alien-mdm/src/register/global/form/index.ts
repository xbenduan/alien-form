import type { Runtime } from "@alien-form/engine";
import { fieldDefinitions } from "./registry";
import { FormItem, FilterItem } from "@components/decorators";

export function registerFormComponents(runtime: Runtime): void {
  for (const definition of Object.values(fieldDefinitions)) {
    runtime.formComponent(definition);
  }
  runtime.formDecorator({
    code: "FormItem",
    title: "表单项",
    description: "显示字段标题、描述和校验状态。",
    component: FormItem,
    authoring: {},
  });
  runtime.formDecorator({
    code: "FilterItem",
    title: "筛选项",
    description: "用于列表筛选区域的紧凑字段容器。",
    component: FilterItem,
    authoring: {},
  });
}
