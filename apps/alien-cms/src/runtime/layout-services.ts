import type { AfUiNode, LayoutServiceMap } from "@alien-form/shared";
import type { ServiceDescribe, ServiceCtx } from "./describe";

/** 从布局根节点读取 props.services；缺失即视为协议错误（破坏式，不做隐式回退）。 */
export function readLayoutServices(node: AfUiNode | undefined): LayoutServiceMap {
  const services = node?.props?.services;
  if (!services || typeof services !== "object") {
    throw new Error(
      `[alien-cms] 布局根节点 "${node?.component ?? "unknown"}" 缺少 props.services 声明`,
    );
  }
  return services as LayoutServiceMap;
}

/**
 * 按语义 key 解析出已注册的 service。
 * key 未在根节点 props.services 中声明、或 service code 未注册时直接抛错。
 */
export function resolveLayoutService(ctx: ServiceCtx, key: string): ServiceDescribe {
  const code = ctx.services[key];
  if (!code) {
    throw new Error(`[alien-cms] 布局未声明 service 语义 "${key}"（model=${ctx.model}）`);
  }
  const service = ctx.runtime.service.query(code, ctx.model);
  if (!service) {
    throw new Error(`[alien-cms] service "${code}" 未注册（语义 ${key}, model=${ctx.model}）`);
  }
  return service;
}
