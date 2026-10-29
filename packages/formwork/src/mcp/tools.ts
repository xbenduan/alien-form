import { z } from "zod";
import {
  checkAbort,
  escapePointer,
  FormworkError,
  modelDocumentSchema,
  modelIssues,
  routePath,
  viewIssues,
} from "../model/index";
import type { Diagnostic, ModelDocument, ModelSource, RouteDefinition } from "../model/index";

/** 保存能力的原始声明和覆盖链，不猜测无法准确转换的 TS 类型。 */
export type CapabilityMember = {
  name: string;
  source: NonNullable<Diagnostic["source"]>;
  declaration: string;
  jsDoc?: string;
  overrides?: readonly NonNullable<Diagnostic["source"]>[];
};
/** 返回指定模型与路由实际可用的静态能力。 */
export type EffectiveCapabilities = {
  modelId: string;
  router: string;
  components: readonly CapabilityMember[];
  fn: readonly CapabilityMember[];
  schema?: CapabilityMember;
  modelContract: string;
  runtimeChecks: readonly Diagnostic[];
};
/** 将工具绑定到现有完整源和应用静态索引。 */
export type ModelToolsOptions = {
  source: ModelSource;
  routes: readonly RouteDefinition[];
  schemaRouters: readonly string[];
  capabilities: (
    modelId: string,
    router: string,
  ) => EffectiveCapabilities | Promise<EffectiveCapabilities>;
  validate?: (document: ModelDocument, router: string) => Promise<readonly Diagnostic[]>;
  origin?: string;
};
const modelId = z.string().regex(/^[a-z][a-z0-9_-]*$/u);
const router = modelId;
/** 为 HTTP 与官方 MCP SDK 提供完全相同的六项输入约束。 */
export const toolInputSchemas = {
  "models.list": z.object({}).strict(),
  "models.read": z.object({ modelId }).strict(),
  "formwork.capabilities": z.object({ modelId, router }).strict(),
  "models.validate": z
    .object({ modelId, document: z.unknown(), router: router.optional() })
    .strict(),
  "models.write": z
    .object({ modelId, document: z.unknown(), ifRevision: z.string().min(1).nullable() })
    .strict(),
  "models.preview": z
    .object({ modelId, router, params: z.record(z.string(), z.string()).optional() })
    .strict(),
};
/** 标识首版模型 MCP 的固定工具名称。 */
export type ModelToolName = keyof typeof toolInputSchemas;
/** 汇总可确定错误与仍需实际 Render 验证的行为。 */
export type ModelValidationReport = {
  errors: readonly Diagnostic[];
  runtimeChecks: readonly Diagnostic[];
};

/** 创建六项共享工具；写入始终复用传入的源与条件版本。 */
export function createModelTools(options: ModelToolsOptions) {
  const ensureRouter = (name: string) => {
    if (!options.routes.some((route) => route.router === name))
      throw new FormworkError("UNKNOWN_ROUTER", `未知 router ${name}`);
  };
  const validate = async (
    id: string,
    document: unknown,
    selectedRouter?: string,
  ): Promise<ModelValidationReport> => {
    if (selectedRouter) ensureRouter(selectedRouter);
    const errors: Diagnostic[] = modelIssues(document).map((issue) => ({
      ...issue,
      modelId: id,
      ...(selectedRouter ? { router: selectedRouter } : {}),
    }));
    if ((document as ModelDocument | undefined)?.id !== id)
      errors.push({
        modelId: id,
        path: "/id",
        code: "INVALID_MODEL",
        message: "modelId 与 document.id 不一致",
      });
    if (errors.length) return { errors, runtimeChecks: [] };
    const model = document as ModelDocument;
    const runtimeChecks: Diagnostic[] = [];
    const targets = selectedRouter ? [selectedRouter] : options.schemaRouters;
    for (const target of targets) {
      const capabilities = await options.capabilities(id, target);
      const view = model.views?.[target] ?? { component: "Object", field: "" };
      errors.push(
        ...viewIssues(
          view,
          model.data,
          capabilities.components.map((member) => member.name),
          model.data,
          `/views/${escapePointer(target)}`,
        ).map((issue) => ({ ...issue, modelId: id, router: target })),
      );
      errors.push(...((await options.validate?.(model, target)) ?? []));
      runtimeChecks.push(...capabilities.runtimeChecks);
    }
    for (const name of Object.keys(model.views ?? {}))
      if (!targets.includes(name))
        runtimeChecks.push({
          modelId: id,
          path: `/views/${escapePointer(name)}`,
          code: "RUNTIME_VIEW",
          message: "该 View 的实际 scope 与局部组件在 Render 时验证",
        });
    if (model.views)
      runtimeChecks.push({
        modelId: id,
        path: "/views",
        code: "RUNTIME_EXPRESSION",
        message: "表达式结果、实际依赖、异步返回和事件需要在浏览器验证",
      });
    return { errors, runtimeChecks };
  };
  return {
    validate,
    async call(name: ModelToolName, input: unknown, signal?: AbortSignal): Promise<unknown> {
      checkAbort(signal);
      const schema = toolInputSchemas[name];
      if (!schema) throw new FormworkError("NOT_FOUND", `未知工具 ${name}`);
      const parsed = schema.safeParse(input);
      if (!parsed.success) throw new FormworkError("INVALID_INPUT", parsed.error.message);
      const args = parsed.data as {
        modelId: string;
        router?: string;
        document?: unknown;
        ifRevision?: string | null;
        params?: Record<string, string>;
      };
      switch (name) {
        case "models.list":
          return options.source.list({ signal });
        case "models.read":
          return options.source.read(args.modelId, { signal });
        case "formwork.capabilities":
          ensureRouter(args.router!);
          return options.capabilities(args.modelId, args.router!);
        case "models.validate":
          return validate(args.modelId, args.document, args.router);
        case "models.write": {
          const report = await validate(args.modelId, args.document);
          if (report.errors.length)
            throw new FormworkError("INVALID_MODEL", "模型校验失败", report.errors);
          checkAbort(signal);
          return options.source.write(modelDocumentSchema.parse(args.document), {
            ifRevision: args.ifRevision!,
            signal,
          });
        }
        case "models.preview": {
          ensureRouter(args.router!);
          const params = { ...args.params, domain: args.modelId };
          routePath(options.routes, args.router!, params);
          const snapshot = await options.source.read(args.modelId, { signal });
          const path = routePath(options.routes, "models", { domain: args.modelId });
          const query = new URLSearchParams({
            ...args.params,
            router: args.router!,
            revision: snapshot.revision,
          });
          return {
            modelId: args.modelId,
            router: args.router!,
            revision: snapshot.revision,
            url: `${options.origin ?? ""}${path}?${query}`,
          };
        }
      }
    },
  };
}
