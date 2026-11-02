import { z } from "zod";
export type { CapabilityMember, EffectiveCapabilities } from "../model/types";
const modelId = z
  .string()
  .regex(/^[a-z][a-z0-9_-]*$/u)
  .describe("模型身份，单段小写标识；未知时先 models.list 或 formwork.describe。");
const router = z
  .string()
  .regex(/^[a-z][a-z0-9_-]*$/u)
  .describe("已登记 Page 名；从 formwork.capabilities({}).targets 选择。");
const window = z
  .string()
  .regex(/^[a-z][a-z0-9_-]*$/u)
  .describe("所属 router 内的 Window 名，从能力目录选择；省略表示 Page。");
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
      window: window.optional(),
      domain: modelId
        .optional()
        .describe("候选 Domain 名；从全量目录 domains 选择，默认使用模型自身配置。"),
    })
    .strict()
    .superRefine((input, context) => {
      if (
        Object.values(input).some((value) => value !== undefined) &&
        (!input.modelId || !input.router)
      )
        context.addIssue({
          code: "custom",
          message:
            "发现全部组件请传 {}，无需页面 URL；查询目标能力必须同时提供 modelId 和 router，可选 window/domain。",
          path: [input.modelId ? "router" : "modelId"],
        });
    }),
  "models.validate": z
    .object({
      modelId,
      definition: z
        .unknown()
        .describe("完整 {document,backend}；结构和模板由 formwork.describe 返回。"),
      router: router.optional(),
      window: window.optional(),
    })
    .strict()
    .refine((input) => !input.window || !!input.router, {
      message: "window 需要所属 router",
      path: ["router"],
    }),
  "models.write": z
    .object({
      modelId,
      definition: z.unknown().describe("完整共享草稿 {document,backend}，不是局部 patch。"),
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
      window: window.optional(),
      params: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "目录 targets.requiredPreviewParams 中的真实路径参数，例如 edit 的 {id:'record-id'}；modelId 自动填入。",
        ),
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
    "传 {} 发现当前应用全部 Framework/Domain/Page/Window 组件与 fn、声明、JSDoc、路由和必填参数；传 {modelId,router,window?,domain?} 查询目标有效能力。无需编辑器 URL 或浏览器。",
  "models.validate": "校验完整后端 definition 并列出错误和浏览器运行时检查",
  "models.write": "按 ifRevision 保存共享草稿；不完整定义可保存诊断，不发布模型",
  "models.preview": "返回受管理权限保护的草稿预览 URL，必填记录参数不可省略",
};
