import type { Runtime } from "@alien-form/engine";

/**
 * 使用者全局覆盖层（无 domain，对所有模型生效）。
 *
 * 在这里覆盖或新增框架 global 基线里的组件 / 服务 / 常量，同 code 依 last-write-wins
 * 覆盖 global。这是使用者定制全局能力的唯一入口，框架升级不会触碰本文件。
 *
 * 示例见 ./README.md。默认空实现。
 */
export function registerOverrides(_runtime: Runtime): void {
  // 使用者在此登记全局覆盖，例如：
  // _runtime.formComponent({ code: "Input", /* ... */ });
  // _runtime.constant("status", [{ label: "在职", value: "on" }]);
}
