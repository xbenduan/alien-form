import {
  createModelDefinitionSchema,
  modelIssues,
  compileDefinition,
  escapePointer,
  schemaType,
  resolveSchema,
  pointerSegments,
  FormworkError,
  resolveModel,
} from "formwork/model";
import type {
  CapabilityManifest,
  DraftDefinition,
  CompiledDefinition,
  ValidationReport,
  RouteTarget,
} from "formwork/model";
import type { StoredModel } from "../contracts";
import { planStorage, bindingKey } from "../adapters/d1/compiler/storage";
import { readPublished } from "../adapters/d1/repositories/models";
import { capabilityReport, readManifest } from "./capabilities";
import { ServiceError } from "../http/errors";
import { modelContract } from "../../../../packages/domain-contracts";
import { schemaMigrationReport } from "./schema-migration";

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
  target?: RouteTarget,
): Promise<{
  report: ValidationReport;
  definition?: CompiledDefinition;
  manifest?: CapabilityManifest;
}> {
  const errors: ValidationReport["errors"][number][] = [];
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  let contract;
  try {
    contract = modelContract({
      id: draft.id,
      ...(typeof draft.domain === "string" ? { domain: draft.domain } : {}),
    });
  } catch (error) {
    return {
      report: {
        errors: [
          {
            path: "/domain",
            code: "UNKNOWN_DOMAIN",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        runtimeChecks,
      },
    };
  }
  const parsed = createModelDefinitionSchema(contract).safeParse(draft);
  if (!parsed.success) {
    errors.push(...modelIssues(draft, contract));
    return { report: { errors, runtimeChecks } };
  }
  const definition = compileDefinition(parsed.data, contract, previous?.definition);
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
      if (
        ["id", "createdAt", "updatedAt", "creatorId"].includes(key) &&
        (!schema.readOnly || type !== "string")
      )
        add(path, "服务端身份字段必须是 readOnly string");
    } catch (error) {
      add(path, error instanceof Error ? error.message : String(error));
    }
  }
  const resolved = resolveModel(definition.schema, contract);
  const checkNested = (pointer: string) => {
    const field = resolved.field(pointer);
    if (pointerSegments(pointer).length > 1 && (field.schema.relation || field.schema.storage))
      add(
        `/data${pointer}`,
        "当前 D1 adapter 仅支持根字段的 relation/storage，请提升为根字段或显式迁移",
      );
    for (const key of Object.keys(field.schema.properties ?? {}))
      checkNested(`${pointer}/${escapePointer(key)}`);
    if (field.schema.items) checkNested(`${pointer}/*`);
    if (field.schema.additionalProperties) checkNested(`${pointer}/*`);
  };
  for (const field of resolved.fields) checkNested(field.path);
  for (const key of Object.keys(document.data.properties))
    if (!keys.has(key)) add(`/data/${escapePointer(key)}`, "字段缺少稳定 storage binding");
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
  for (const relation of backend.relations) {
    const path = `/data/${escapePointer(bindingKey(backend.storage.bindings.find((binding) => binding.id === relation.fieldId)!))}/relation`;
    const source = backend.storage.bindings.find((binding) => binding.id === relation.fieldId);
    if (!source || relationIds.has(relation.fieldId)) {
      add(path, "关系源字段不存在或重复");
      continue;
    }
    relationIds.add(relation.fieldId);
    const schema = resolveSchema(document.data.properties[bindingKey(source)]!, document.data);
    const sourceType = schemaType(
      "items" in schema ? resolveSchema(schema.items, document.data) : schema,
    );
    if (!["string", "number", "integer", "boolean"].includes(sourceType))
      add(path, "关系值必须是非 null 原子类型");
    try {
      const target =
        relation.targetModel === document.id
          ? { definition }
          : await readPublished(db, relation.targetModel);
      const binding = target.definition.backend.storage.bindings.find(
        (item) => item.path === relation.valueField,
      );
      if (!binding || (binding.path !== "/id" && binding.index !== "unique"))
        add(path, "关系目标必须是 id 或有唯一索引的稳定字段");
      if (binding) relation.targetFieldId = binding.id;
      if (binding && target.definition.backend.permissions.privateFields.includes(binding.id))
        add(path, "不能引用私有目标字段");
      if (
        binding &&
        schemaType(
          resolveSchema(
            target.definition.document.data.properties[bindingKey(binding)]!,
            target.definition.document.data,
          ),
        ) !== sourceType
      )
        add(path, "源值类型必须与目标 valueField 类型相同");
      const label = target.definition.backend.storage.bindings.find(
        (item) => item.path === relation.labelField,
      );
      if (!label || label.encoding !== "scalar")
        add(`${path}/labelField`, "labelField 必须指向已声明的根原子字段");
      else if (target.definition.backend.permissions.privateFields.includes(label.id))
        add(`${path}/labelField`, "不能展示私有目标字段");
    } catch {
      add(path, `目标模型 ${relation.targetModel} 尚未发布`);
    }
  }
  if (document.tree) {
    const parentKey = pointerSegments(document.tree.parentField)[0]!;
    const parent = backend.storage.bindings.find((binding) => bindingKey(binding) === parentKey);
    if (
      !backend.relations.some(
        (relation) =>
          relation.fieldId === parent?.id &&
          relation.kind === "many-to-one" &&
          relation.targetModel === document.id &&
          relation.valueField === "/id",
      )
    )
      add("/tree/parentField", "tree 父级字段必须声明指向当前模型 id 的单引用关系");
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
        add("/data", "系统身份和认证字段不可删除或改变；可以添加其他字段");
    }
    for (const id of previous.definition.backend.permissions.privateFields)
      if (!backend.permissions.privateFields.includes(id))
        add("/backend/permissions/privateFields", "系统私有字段不可公开");
  }
  if (previous) {
    const migration = await schemaMigrationReport(db, previous, definition);
    errors.push(...migration.errors);
    runtimeChecks.push(...migration.runtimeChecks);
  }
  let manifest: CapabilityManifest | undefined;
  try {
    manifest = await readManifest(db);
    const report = capabilityReport(manifest, definition.schema, target);
    errors.push(...report.errors);
    runtimeChecks.push(...report.runtimeChecks);
  } catch (error) {
    add(
      "/data",
      error instanceof Error ? error.message : String(error),
      error instanceof FormworkError ? error.code : "CAPABILITIES_UNAVAILABLE",
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
