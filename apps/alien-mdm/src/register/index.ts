import type { Runtime } from "@alien-form/engine";
import { registerGlobal } from "./global";

/**
 * 注册总入口：
 *  1. registerGlobal —— 全局组件/表单组件/常量（所有模型默认共用）。
 *  2. 各 register/{model}/index.ts —— 仅在特殊模型需要覆盖/新增组件时按需引入，
 *     以 model 名为 domain 注册（runtime 渲染时优先取 domain 覆盖、回退 global）。
 *
 * 约定：绝大多数模型只吃 global；只有个别模型需要定制时，才新建
 * register/{model}/index.ts 导出一个 (runtime) => void，在下面登记即可。
 */
type ModelRegister = (runtime: Runtime) => void;

/** 特殊模型的定制注册表：key 为 model 名（= 页面 domain），value 为注册函数。 */
const modelRegisters: Record<string, ModelRegister> = {
  // 示例：需要为某模型覆盖组件时在此登记，例如
  // "school-user": registerSchoolUser,
};

export function registerAll(runtime: Runtime): void {
  registerGlobal(runtime);
  for (const register of Object.values(modelRegisters)) {
    register(runtime);
  }
}
