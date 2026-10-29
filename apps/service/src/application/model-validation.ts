import {
  modelDefinitionSchema,
  modelIssues,
  escapePointer,
  schemaType,
  resolveSchema,
  viewIssues,
  expressionBody,
} from "formwork/model";
import type {
  CapabilityManifest,
  DraftDefinition,
  ModelDefinition,
  ValidationReport,
  JsonValue,
} from "formwork/model";
import type { StoredModel } from "../contracts";
import { planStorage, bindingKey } from "../adapters/d1/compiler/storage";
import { readPublished } from "../adapters/d1/repositories/models";
import { effectiveCapabilities, readManifest } from "./capabilities";
import { ServiceError } from "../http/errors";

/** 列出可由定义引用的可信 Worker 规则，上传的源码永远不能进入注册表。 */
export const behaviorRules = new Set([
  "system.password",
  "system.users",
  "system.roles",
  "system.categories",
]);
/** 声明可信命令与事件名，各自与服务端操作权限绑定。 */
export const behaviorCommands = new Set(["records.count"]);
/** 声明持久化 outbox 可调用的可信 handler。 */
export const behaviorEvents = new Set(["audit.record"]);

/** 诊断可保存草稿，按当前能力、关系、权限及实际存储验证发布条件。 */
export async function validateDefinition(
  db: D1Database,
  draft: DraftDefinition,
  previous?: StoredModel,
  router?: string,
): Promise<{
  report: ValidationReport;
  definition?: ModelDefinition;
  manifest?: CapabilityManifest;
}> {
  const errors: ValidationReport["errors"][number][] = modelIssues(draft.document).map((issue) => ({
    ...issue,
    path: `/document${issue.path}`,
    modelId: draft.document.id,
  }));
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  const parsed = modelDefinitionSchema.safeParse(draft);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "document" && errors.length) continue;
      errors.push({
        path: `/${issue.path.map((part) => escapePointer(String(part))).join("/")}`,
        code: "INVALID_MODEL",
        message: issue.message,
      });
    }
    return { report: { errors, runtimeChecks } };
  }
  const definition = parsed.data;
  const { backend, document } = definition;
  const add = (path: string, message: string, code = "INVALID_MODEL") =>
    errors.push({ path, message, code });
  const ids = new Set<string>(),
    keys = new Set<string>();
  for (const [index, binding] of backend.storage.bindings.entries()) {
    const path = `/backend/storage/bindings/${index}`;
    try {
      const key = bindingKey(binding);
      if (ids.has(binding.id)) add(path, "稳定字段 id 重复");
      if (keys.has(key)) add(path, "字段 Pointer 重复");
      ids.add(binding.id);
      keys.add(key);
      const schema = document.data.properties[key];
      if (!schema) {
        add(path, "binding 必须对应已声明的根字段");
        continue;
      }
      const type = schemaType(resolveSchema(schema, document.data));
      const complex = ["object", "array"].includes(type);
      if (complex !== (binding.encoding === "json"))
        add(path, "object/array 必须使用 JSON 编码，标量使用 scalar");
      const sqlType = ["integer", "boolean"].includes(type)
        ? "INTEGER"
        : type === "number"
          ? "REAL"
          : "TEXT";
      if (binding.sqlType !== sqlType) add(path, `${type} 应使用 ${sqlType} 存储`);
      if (["id", "createdAt", "updatedAt", "creatorId"].includes(key) && !schema.readOnly)
        add(path, "服务端身份字段必须 readOnly");
    } catch (error) {
      add(path, error instanceof Error ? error.message : String(error));
    }
  }
  for (const key of Object.keys(document.data.properties))
    if (!keys.has(key))
      add(`/document/data/properties/${escapePointer(key)}`, "字段缺少稳定 storage binding");
  for (const id of backend.permissions.privateFields) {
    if (!ids.has(id)) add("/backend/permissions/privateFields", `未知字段 ${id}`);
    const binding = backend.storage.bindings.find((item) => item.id === id);
    if (binding && ["id", "createdAt", "updatedAt", "creatorId"].includes(bindingKey(binding)))
      add("/backend/permissions/privateFields", "服务端记录身份字段不能标记为私有");
  }
  const roles = await readPublished(db, "system-roles");
  const { quote } = await import("../adapters/d1/compiler/storage");
  const roleIds = new Set(
    (
      await db.prepare(`SELECT id FROM ${quote(roles.manifest.table)}`).all<{ id: string }>()
    ).results.map((row) => row.id),
  );
  for (const [index, grant] of backend.permissions.grants.entries()) {
    if (!roleIds.has(grant.roleId))
      add(`/backend/permissions/grants/${index}/roleId`, "角色不存在");
    for (const id of grant.fields ?? [])
      if (!ids.has(id)) add(`/backend/permissions/grants/${index}/fields`, `未知稳定字段 ${id}`);
  }
  const relationIds = new Set<string>();
  for (const [index, relation] of backend.relations.entries()) {
    const path = `/backend/relations/${index}`;
    const source = backend.storage.bindings.find((binding) => binding.id === relation.fieldId);
    if (!source || relationIds.has(relation.fieldId)) {
      add(path, "关系源字段不存在或重复");
      continue;
    }
    relationIds.add(relation.fieldId);
    const schema = resolveSchema(document.data.properties[bindingKey(source)]!, document.data);
    if (schemaType(schema) !== (relation.kind === "many-to-many" ? "array" : "string"))
      add(path, "关系字段类型与基数不匹配");
    if (
      relation.kind === "many-to-many" &&
      "items" in schema &&
      schemaType(resolveSchema(schema.items, document.data)) !== "string"
    )
      add(path, "many-to-many 的 items 必须是 string");
    try {
      const target = await readPublished(db, relation.targetModel);
      const binding = target.definition.backend.storage.bindings.find(
        (item) => item.id === relation.targetFieldId,
      );
      if (relation.targetFieldId !== "id" && (!binding || binding.index !== "unique"))
        add(path, "关系目标必须是 id 或有唯一索引的稳定字段");
      if (binding && target.definition.backend.permissions.privateFields.includes(binding.id))
        add(path, "不能引用私有目标字段");
      if (
        binding &&
        schemaType(
          resolveSchema(
            target.definition.document.data.properties[bindingKey(binding)]!,
            target.definition.document.data,
          ),
        ) !== "string"
      )
        add(path, "关系目标值字段必须是 string");
    } catch {
      add(path, `目标模型 ${relation.targetModel} 尚未发布`);
    }
  }
  for (const name of backend.behavior.rules) {
    if (!behaviorRules.has(name) || !document.id.startsWith("system-"))
      add("/backend/behavior/rules", `不允许引用规则 ${name}`);
    if (
      name.startsWith("system.") &&
      name !== "system.password" &&
      name !==
        `system.${document.id === "system-model-categories" ? "categories" : document.id.slice(7)}`
    )
      add("/backend/behavior/rules", "系统规则只能由对应系统模型引用");
    if (name === "system.password" && document.id !== "system-users")
      add("/backend/behavior/rules", "密码规则只能由用户模型引用");
  }
  for (const name of Object.values(backend.behavior.commands))
    if (!behaviorCommands.has(name)) add("/backend/behavior/commands", `未知可信命令 ${name}`);
  for (const [topic, names] of Object.entries(backend.behavior.events)) {
    if (!["create", "update", "delete"].includes(topic))
      add("/backend/behavior/events", `未知记录事件 ${topic}`);
    for (const name of names)
      if (!behaviorEvents.has(name)) add("/backend/behavior/events", `未知可信事件 ${name}`);
  }
  if (previous && document.id.startsWith("system-")) {
    for (const required of previous.definition.backend.behavior.rules)
      if (!backend.behavior.rules.includes(required))
        add("/backend/behavior/rules", "系统可信规则不可移除");
    for (const binding of previous.definition.backend.storage.bindings) {
      const next = backend.storage.bindings.find((item) => item.id === binding.id);
      if (
        !next ||
        next.path !== binding.path ||
        JSON.stringify(document.data.properties[bindingKey(next)]) !==
          JSON.stringify(previous.definition.document.data.properties[bindingKey(binding)])
      )
        add("/document/data", "系统身份和认证字段不可删除或改变；可以添加其他字段");
    }
    for (const id of previous.definition.backend.permissions.privateFields)
      if (!backend.permissions.privateFields.includes(id))
        add("/backend/permissions/privateFields", "系统私有字段不可公开");
  }
  let manifest: CapabilityManifest | undefined;
  try {
    manifest = await readManifest(db);
    const routers = router ? [router] : manifest.schemaRouters;
    for (const name of routers) {
      const capabilities = effectiveCapabilities(manifest, document.id, name);
      if (!manifest.schemaRouters.includes(name)) {
        add("/document/views", `router ${name} 不加载 schema`);
        continue;
      }
      const view = document.views?.[name];
      if (view)
        errors.push(
          ...viewIssues(
            view,
            document.data,
            capabilities.components.map((component) => component.name),
          ).map((issue) => ({
            ...issue,
            path: `/document/views/${escapePointer(name)}${issue.path}`,
            router: name,
          })),
        );
      const visit = (value: JsonValue, path: string) => {
        const body = expressionBody(value);
        if (body) {
          for (const match of body.matchAll(/\bfn\.([A-Za-z_$][\w$]*)/gu))
            if (!capabilities.fn.some((fn) => fn.name === match[1]))
              add(path, `未知 fn ${match[1]}`, "UNKNOWN_FN");
          runtimeChecks.push({
            path,
            code: "EXPRESSION_RUNTIME",
            message: "表达式行为需要在浏览器预览执行",
            router: name,
          });
        }
        if (Array.isArray(value)) value.forEach((child, index) => visit(child, `${path}/${index}`));
        else if (value && typeof value === "object")
          for (const [key, child] of Object.entries(value))
            visit(child, `${path}/${escapePointer(key)}`);
      };
      if (view) visit(view as unknown as JsonValue, `/document/views/${escapePointer(name)}`);
      runtimeChecks.push(...capabilities.runtimeChecks);
    }
    for (const name of Object.keys(document.views ?? {}))
      if (!manifest.schemaRouters.includes(name))
        add(`/document/views/${escapePointer(name)}`, "View router 不存在或不加载 schema");
  } catch (error) {
    add(
      "/document/views",
      error instanceof Error ? error.message : String(error),
      "CAPABILITIES_UNAVAILABLE",
    );
  }
  try {
    await planStorage(db, definition, previous?.manifest);
  } catch (error) {
    if (error instanceof ServiceError && error.issues.length) errors.push(...error.issues);
    else
      add(
        "/backend/storage",
        error instanceof Error ? error.message : String(error),
        "STORAGE_INCOMPATIBLE",
      );
  }
  return { report: { errors, runtimeChecks }, definition, manifest };
}
