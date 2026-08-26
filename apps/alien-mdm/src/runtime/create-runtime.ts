import { Runtime } from "@alien-form/engine";
import { MemoryRouterAdapter } from "@alien-form/engine";
import { registerAll } from "../register";

let appRuntime: Runtime | undefined;

export function createAppRuntime(): Runtime {
  if (appRuntime) return appRuntime;

  const runtime = new Runtime({
    router: new MemoryRouterAdapter({ path: "/" }),
  });

  runtime.constant("i18n", {});

  // 全局 + per-model 能力注册（services / 组件 / 常量，业务枚举常量在 register/global 内维护）。
  registerAll(runtime);

  appRuntime = runtime;
  return runtime;
}

export function getAppRuntime(): Runtime {
  if (!appRuntime) throw new Error("[alien-mdm] Runtime not initialized");
  return appRuntime;
}
