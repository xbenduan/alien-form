import type { Runtime, ServiceDescriptor } from "@alien-form/engine";
import { recordsServices } from "./records";
import { schemaServices } from "./schema";
import { authServices } from "./auth";

export type ServiceSend = ServiceDescriptor["send"];

/** 汇总所有全局 service；对象合并天然按 code 去重（后者覆盖前者）。 */
const globalServices: Record<string, ServiceSend> = {
  ...recordsServices,
  ...schemaServices,
  ...authServices,
};

/** 将全局 service 注册进 runtime（无 domain，任意页面/单例均可解析）。 */
export function registerServices(runtime: Runtime): void {
  for (const [code, send] of Object.entries(globalServices)) {
    runtime.service({ code, send });
  }
}
