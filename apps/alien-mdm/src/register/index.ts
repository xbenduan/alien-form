import type { Runtime } from "@alien-form/engine";
import { registerGlobal } from "./global";
import { registerOverrides } from "./overrides";

/**
 * 注册总入口 —— 分三层，优先级由低到高：
 *
 *  1. registerGlobal —— 框架开发者维护的全局基线（组件 / 服务 / 常量）。
 *     位于 `register/global/**`，使用者不改动此目录。优先级最低。
 *
 *  2. registerOverrides —— 使用者的全局覆盖层（无 domain）。
 *     位于 `register/overrides/index.ts`，同 code 依 last-write-wins 覆盖 global 基线。
 *
 *  3. register/{modelCode}/index.ts —— 使用者的模型定制层（domain = 目录名）。
 *     通过 import.meta.glob 自动发现，仅限一级、文件名固定为 index.ts。
 *     带 domain 注册，渲染时 runtime 优先取 domain 覆盖、回退 global。优先级最高。
 *
 * 使用者只在 overrides/ 和 {modelCode}/ 下工作，永不编辑本文件或 global 目录，
 * 从而与框架开发者代码保持零冲突、随时可同步升级。
 */
type ModelRegisterModule = { default?: (runtime: Runtime, domain: string) => void };

/** 使用者模型定制：仅匹配一级 register/{modelCode}/index.ts（不支持嵌套）。 */
const modelModules = import.meta.glob<ModelRegisterModule>("./*/index.ts", { eager: true });

const RESERVED_DIRS = new Set(["global", "overrides"]);

/** 从 "./{modelCode}/index.ts" 提取模型名作为 domain。 */
function domainOf(path: string): string {
  return path.replace(/^\.\//, "").split("/")[0];
}

export function registerAll(runtime: Runtime): void {
  // 1. 框架基线（优先级最低）
  registerGlobal(runtime);

  // 2. 使用者全局覆盖（last-write-wins）
  registerOverrides(runtime);

  // 3. 使用者模型定制（domain 作用域，优先级最高）
  for (const [path, mod] of Object.entries(modelModules)) {
    const domain = domainOf(path);
    if (RESERVED_DIRS.has(domain)) continue;
    mod.default?.(runtime, domain);
  }
}
