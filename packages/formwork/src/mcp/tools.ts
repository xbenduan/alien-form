import { z } from "zod";
export type { CapabilityMember, EffectiveCapabilities } from "../model/types";
const modelId = z.string().regex(/^[a-z][a-z0-9_-]*$/u);
/** 为 Worker 与官方 MCP SDK 提供同一份六项输入约束。 */
export const toolInputSchemas = {
  "models.list": z.object({}).strict(),
  "models.read": z.object({ modelId }).strict(),
  "formwork.capabilities": z.object({ modelId, router: modelId }).strict(),
  "models.validate": z
    .object({ modelId, definition: z.unknown(), router: modelId.optional() })
    .strict(),
  "models.write": z
    .object({ modelId, definition: z.unknown(), ifRevision: z.string().min(1).nullable() })
    .strict(),
  "models.preview": z
    .object({ modelId, router: modelId, params: z.record(z.string(), z.string()).optional() })
    .strict(),
};
/** 标识只操作最新管理状态的六项 MCP 工具。 */
export type ModelToolName = keyof typeof toolInputSchemas;
/** 说明工具的草稿语义；发布始终由管理页手动完成。 */
export const toolDescriptions: Record<ModelToolName, string> = {
  "models.list": "列出当前身份可管理的模型目录",
  "models.read": "读取最新共享草稿；无草稿时返回最新发布定义和管理 revision",
  "formwork.capabilities": "读取路由的有效组件、fn、源码声明与 JSDoc",
  "models.validate": "校验完整后端 definition 并列出错误和浏览器运行时检查",
  "models.write": "按 ifRevision 保存共享草稿；不完整定义可保存诊断，不发布模型",
  "models.preview": "返回受管理权限保护的草稿预览 URL，必填记录参数不可省略",
};
