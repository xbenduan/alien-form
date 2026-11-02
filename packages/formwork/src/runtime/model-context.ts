import { FormworkError } from "../model/errors";
import { presentationIssues, selectDomain } from "../model/definition-policy";
import { cloneJson } from "../model/pointer";
import { createRoutes } from "../model/routes";
import { assertRuntimeSchema, modelDocumentSchema } from "../model/schema";
import type { OpenMode, RuntimeSchema } from "../model/types";
import { bindFunctions, mergeDefaults, resolveDomain } from "./resolve";
import type { ActionContext, DomainSchemaContext, FormworkDefinition, PageDefinition, RenderDefaults } from "./types";

/** 保存一次 Page 加载后的不可变模型快照及尚未绑定的能力。 */
export type ModelContext = {
  schema: RuntimeSchema;
  domain?: string;
  effective: RenderDefaults;
};

function freezeSnapshot<T>(input: T): T {
  if (input && typeof input === "object" && !Object.isFrozen(input)) {
    for (const value of Object.values(input)) freezeSnapshot(value);
    Object.freeze(input);
  }
  return input;
}

/** 先读文档再选择 Domain，固定身份和 schema，并仅加工一次。 */
export async function prepareModel(
  app: FormworkDefinition,
  page: PageDefinition,
  ctx: ActionContext,
): Promise<ModelContext> {
  if (!ctx.modelId) throw new FormworkError("PARAMS_REQUIRED", `模型 Page ${page.router} 缺少 modelId`);
  const loader = page.getSchema ?? app.getSchema;
  if (!loader) throw new FormworkError("INVALID_DEFINITION", `缺少 getSchema: ${page.router}`);
  const params = ctx.params;
  const raw = modelDocumentSchema.parse(await loader({
    modelId: ctx.modelId, router: page.router, params, api: ctx.api, signal: ctx.signal,
  }));
  if (ctx.signal.aborted) throw new FormworkError("ABORTED", "Instance 已销毁");
  if (raw.id !== ctx.modelId) throw new FormworkError("INVALID_MODEL", "URL modelId 与模型 id 不一致");
  const domain = selectDomain(raw, app.domains ?? {});
  const override = await resolveDomain(app, domain);
  if (ctx.signal.aborted) throw new FormworkError("ABORTED", "Instance 已销毁");
  const effective = mergeDefaults(app, override, page);
  const validator = override.modelSchema ?? app.modelSchema;
  const normalized = modelDocumentSchema.parse(validator ? validator.parse(cloneJson(raw as never)) : raw);
  if (normalized.id !== raw.id || normalized.domain !== raw.domain)
    throw new FormworkError("INVALID_MODEL", "modelSchema 不能改变模型 id 或 domain");
  // 加工始终绑定所属 Page；直达 Window 不把记录参数或 Window 能力混入加工。
  const pageContext: ActionContext = {
    ...ctx, router: page.router, window: undefined, domain, schema: cloneJson(normalized as never), fn: {},
  };
  bindFunctions(effective, pageContext);
  const schema = assertRuntimeSchema(override.transformSchema
    ? await override.transformSchema(pageContext as DomainSchemaContext)
    : pageContext.schema);
  if (ctx.signal.aborted) throw new FormworkError("ABORTED", "Instance 已销毁");
  if (schema.id !== raw.id || schema.domain !== raw.domain)
    throw new FormworkError("INVALID_MODEL", "transformSchema 不能改变模型 id 或 domain");
  const issues = presentationIssues(schema, createRoutes(app.pages), Object.keys(app.presenters) as OpenMode[]);
  if (issues.length) throw new FormworkError(issues[0]!.code, "页面打开方式配置不合法", issues);
  return { schema: freezeSnapshot(schema), domain, effective };
}
