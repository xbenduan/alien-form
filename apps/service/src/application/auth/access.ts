import {
  runtimeDocument,
  resolveFieldSchema,
  resolveModel,
  pointerSegments,
  queryOperatorsForField,
} from "formwork/model";
import type {
  ModelAction,
  ModelDocument,
  RecordValue,
  FieldSchema,
  RecordCapabilities,
} from "formwork/model";
import type { Actor, StoredModel } from "../../contracts";
import { readPublished } from "../../adapters/d1/repositories/models";
import { decodeRow, readRow, withRelations } from "../../adapters/d1/repositories/values";
import type { PhysicalRow } from "../../adapters/d1/repositories/values";
import { bindingKey, quote } from "../../adapters/d1/compiler/storage";
import { forbidden, ServiceError } from "../../http/errors";
import { modelContract } from "../../../../../packages/domain-contracts";

/** 从 DB 当前用户、角色及可信角色标记构造权限档案，保留角色子树聚合。 */
export async function resolveActor(
  db: D1Database,
  userId: string,
  kind: Actor["kind"],
  credentialId: string,
): Promise<Actor> {
  const [users, roles] = await Promise.all([
    readPublished(db, "system-users"),
    readPublished(db, "system-roles"),
  ]);
  const row = await readRow(db, users, userId);
  if (!row) throw new ServiceError("UNAUTHORIZED", "用户不存在", 401);
  const user = await withRelations(db, users, row);
  const assigned = Array.isArray(user.roleId)
    ? user.roleId.filter((value): value is string => typeof value === "string")
    : [];
  const trusted = await db
    .prepare("SELECT record_id FROM fw_system_identities WHERE name = 'super-role'")
    .first<{ record_id: string }>();
  const superUser = !!trusted && assigned.includes(trusted.record_id);
  const allRoles = (
    await db.prepare(`SELECT * FROM ${quote(roles.manifest.table)}`).all<PhysicalRow>()
  ).results.map((role) => decodeRow(roles, role));
  const byId = new Map(allRoles.map((role) => [String(role.id), role]));
  const roleIds = new Set<string>();
  let canCreateModel = superUser;
  const queue = [...assigned];
  while (queue.length) {
    const id = queue.shift()!;
    if (roleIds.has(id)) continue;
    const role = byId.get(id);
    if (!role) continue;
    roleIds.add(id);
    canCreateModel ||= role.canCreateModel === true;
    for (const child of allRoles) if (child.parentId === id) queue.push(String(child.id));
  }
  return {
    id: userId,
    username: String(user.username),
    kind,
    credentialId,
    roleIds,
    super: superUser,
    canCreateModel,
  };
}
/** 表示一个操作合并后的根字段与所有者范围。 */
export type Access = { fields: ReadonlySet<string>; scope: "all" | "own"; allowed: boolean };
/** 按独立 action 合并版本化 grants，私有字段在所有身份下均排除。 */
export function accessFor(model: StoredModel, actor: Actor, action: ModelAction): Access {
  const { permissions, storage } = model.definition.backend;
  const all = storage.bindings
    .filter((binding) => !permissions.privateFields.includes(binding.id))
    .map(bindingKey);
  if (actor.super || (["manage", "publish"].includes(action) && model.head.creator_id === actor.id))
    return { allowed: true, fields: new Set(all), scope: "all" };
  let allowed = false;
  let scope: Access["scope"] = "own";
  const fields = new Set<string>();
  for (const grant of permissions.grants) {
    if (!actor.roleIds.has(grant.roleId) || !grant.actions.includes(action)) continue;
    allowed = true;
    if (grant.scope === "all") scope = "all";
    for (const binding of storage.bindings)
      if (
        !permissions.privateFields.includes(binding.id) &&
        (!grant.fields || grant.fields.includes(binding.id))
      )
        fields.add(bindingKey(binding));
  }
  return { allowed, fields, scope };
}
/** 验证操作与 own 所有者限制，隐藏无权读取的记录身份。 */
export function requireAccess(
  model: StoredModel,
  actor: Actor,
  action: ModelAction,
  record?: RecordValue,
): Access {
  const access = accessFor(model, actor, action);
  if (!access.allowed) forbidden();
  if (record && access.scope === "own" && record.creatorId !== actor.id)
    throw new ServiceError("NOT_FOUND", "记录不存在", 404);
  return access;
}
/** 投影记录只保留授权字段及服务端记录身份。 */
export function projectRecord(record: RecordValue, access: Access): RecordValue {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]) =>
        ["id", "createdAt", "updatedAt", "creatorId"].includes(key) || access.fields.has(key),
    ),
  );
}
/** 返回当前身份与 D1 实际支持的字段能力，query 只能缩小这个集合。 */
export function recordCapabilities(model: StoredModel, actor: Actor): RecordCapabilities {
  const read = accessFor(model, actor, "read");
  const create = accessFor(model, actor, "create");
  const update = accessFor(model, actor, "update");
  const resolved = resolveModel(
    runtimeDocument(model.definition),
    modelContract(model.definition.schema),
  );
  return {
    fields: Object.fromEntries(
      resolved.fields.map((field) => {
        const key = pointerSegments(field.path)[0]!;
        const canRead =
          read.allowed &&
          (read.fields.has(key) || ["id", "createdAt", "updatedAt", "creatorId"].includes(key));
        const schema = field.schema;
        const scalar = !["object", "array"].includes(schema.type!);
        return [
          field.path,
          {
            read: canRead,
            create: create.allowed && create.fields.has(key) && !schema.readOnly,
            update: update.allowed && update.fields.has(key) && !schema.readOnly,
            filter: canRead && schema.query?.filter !== false ? queryOperatorsForField(schema) : [],
            sort: canRead && scalar && schema.query?.sort !== false,
          },
        ];
      }),
    ),
  };
}

/** 按字段权限投影同一协议，展开引用且剔除物理存储信息。 */
export function projectSchema(model: StoredModel, actor: Actor): ModelDocument {
  const original = runtimeDocument(model.definition);
  const accesses = ["read", "create", "update"].map((action) =>
    accessFor(model, actor, action as ModelAction),
  );
  if (!accesses.some((access) => access.allowed)) forbidden();
  const fields = new Set(accesses.flatMap((access) => (access.allowed ? [...access.fields] : [])));
  for (const key of ["id", "createdAt", "updatedAt", "creatorId"]) fields.add(key);
  const editable = new Set(
    accesses.slice(1).flatMap((access) => (access.allowed ? [...access.fields] : [])),
  );
  const inline = (node: FieldSchema): FieldSchema => {
    const value = structuredClone(resolveFieldSchema(node, original));
    delete value.storage;
    if (value.properties)
      value.properties = Object.fromEntries(
        Object.entries(value.properties).map(([key, child]) => [key, inline(child)]),
      );
    if (value.items) value.items = inline(value.items);
    if (value.additionalProperties) value.additionalProperties = inline(value.additionalProperties);
    return value;
  };
  const schema = structuredClone(original);
  schema.data = Object.fromEntries(
    Object.entries(original.data)
      .filter(([key]) => fields.has(key))
      .map(([key, node]) => [
        key,
        { ...inline(node), ...(!editable.has(key) ? { readOnly: true } : {}) },
      ]),
  );
  delete schema.$defs;
  const hidden = new Set(Object.keys(original.data).filter((key) => !fields.has(key)));
  if (
    schema.tree &&
    [schema.tree.parentField, schema.tree.labelField].some((pointer) =>
      hidden.has(pointerSegments(pointer)[0]!),
    )
  )
    delete schema.tree;
  return schema;
}
