import type { Runtime } from "@alien-form/engine";
import { registerUIComponents } from "./ui";
import { registerPageComponents } from "./pages";
import { registerFormComponents } from "./form";
import { registerConstant } from "./constant";
import { registerServices } from "./services";

/**
 * 全局能力注册：包含渲染类（ui / pages / form 组件、常量）与数据类（services）。
 * “global” 指默认对所有模型生效、无 domain 作用域。
 */
export function registerGlobal(runtime: Runtime): void {
  registerServices(runtime);
  registerUIComponents(runtime);
  registerPageComponents(runtime);
  registerFormComponents(runtime);
  registerConstant(runtime);
}
