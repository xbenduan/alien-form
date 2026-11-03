import { z } from "zod";
export type { CapabilityMember, EffectiveCapabilities } from "../model/types";
const modelId = z
  .string()
  .regex(/^[a-z][a-z0-9_-]*$/u)
  .describe("模型身份，单段小写标识；未知时先 models.list 或 formwork.describe。");
const router = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/u)
  .describe("已登记 Domain 的 router；从 formwork.capabilities({}).targets 选择。");
/** 为 Worker 与官方 MCP SDK 提供同一份工具输入约束。 */
export const toolInputSchemas = {
  "formwork.describe": z
    .object({ modelId: modelId.optional().describe("可选的新模型模板身份；省略时生成候选 ID。") })
    .strict(),
  "models.list": z.object({}).strict(),
  "models.read": z.object({ modelId }).strict(),
  "formwork.capabilities": z
    .object({
      modelId: modelId.optional(),
      router: router.optional(),
    })
    .strict()
    .superRefine((input, context) => {
      if (
        Object.values(input).some((value) => value !== undefined) &&
        (!input.modelId || !input.router)
      )
        context.addIssue({
          code: "custom",
          message: "发现全部组件请传 {}；查询目标能力必须同时提供 modelId 和 router。",
          path: [input.modelId ? "router" : "modelId"],
        });
    }),
  "models.validate": z
    .object({
      modelId,
      definition: z
        .unknown()
        .describe(
          "完整 {schemaVersion:1,id,title,data,...}；结构和模板由 formwork.describe 返回。",
        ),
      router: router.optional(),
    })
    .strict(),
  "models.write": z
    .object({
      modelId,
      definition: z
        .unknown()
        .describe("完整作者 Schema {schemaVersion:1,id,title,data,...}，不是局部 patch。"),
      ifRevision: z
        .string()
        .min(1)
        .nullable()
        .describe("新建必须 null；修改使用最近 read/write 返回的 revision。"),
    })
    .strict(),
  "models.preview": z
    .object({
      modelId,
      router,
    })
    .strict(),
};
/** 标识应用发现与最新模型管理状态的 MCP 工具。 */
export type ModelToolName = keyof typeof toolInputSchemas;
/** 说明工具的草稿语义；发布始终由管理页手动完成。 */
export const toolDescriptions: Record<ModelToolName, string> = {
  "formwork.describe":
    "首次连接必读；传 {} 获取完整模型构建指南、definition JSON Schema、可用模板、当前权限、组件目录和调用示例。无需项目上下文、页面 URL 或已有模型。",
  "models.list": "列出当前身份可管理的模型目录",
  "models.read": "读取最新共享草稿；无草稿时返回最新发布定义和管理 revision",
  "formwork.capabilities":
    "传 {} 发现 app 共享组件、formats、UI 声明、JSDoc 和 Domain/Page 路由；传 {modelId,router} 查询目标有效能力。需要应用登记可选静态清单。",
  "models.validate": "校验完整后端 definition 并列出错误和浏览器运行时检查",
  "models.write": "按 ifRevision 保存共享草稿；不完整定义可保存诊断，不发布模型",
  "models.preview": "返回受管理权限保护的模型草稿预览 URL，预览记录仅保存在浏览器内存中",
};
