import type {
  AlienFieldSchema,
  ModelRecord,
  AlienSchema,
  PermissionAction,
} from "@alien-form/protocol";
import { SYS_MODEL_TAB_MODEL } from "../domain/schemas/_sys_model_tab.ts";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "../domain/schemas/_sys_role.ts";
import { SYS_ADMIN_ID, SYS_USER_MODEL } from "../domain/schemas/_sys_user.ts";
import { forbidden } from "../errors.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";

export type { PermissionAction } from "@alien-form/protocol";
export type PermissionScope = "all" | "own";

interface PersistedPermission {
  model: string;
  actions: PermissionAction[];
  fields: string[];
  scope: PermissionScope;
}

export interface PermissionGrant {
  actions: ReadonlySet<PermissionAction>;
  fields: ReadonlySet<string>;
  scope: PermissionScope;
}

export interface AccessProfile {
  actorId: string;
  roleIds: string[];
  permissions: Map<string, PermissionGrant>;
  canCreateModel: boolean;
  super: boolean;
}

const ACTIONS = new Set<PermissionAction>(["read", "create", "update", "delete"]);

function projectSlots(
  slots: AlienFieldSchema["slots"],
  actions: ReadonlySet<PermissionAction>,
  allowed?: ReadonlySet<string>,
): AlienFieldSchema["slots"] {
  if (!slots) return undefined;
  const projected = Object.fromEntries(
    Object.entries(slots).flatMap(([name, nodes]) => {
      const children = Object.fromEntries(
        Object.entries(nodes).flatMap(([key, child]) => {
          const projectedChild = projectNode(child, actions, allowed);
          return projectedChild ? [[key, projectedChild]] : [];
        }),
      );
      return Object.keys(children).length > 0 ? [[name, children]] : [];
    }),
  );
  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectNode(
  node: AlienFieldSchema,
  actions: ReadonlySet<PermissionAction>,
  allowed?: ReadonlySet<string>,
): AlienFieldSchema | undefined {
  if (node.permission && !actions.has(node.permission)) return undefined;
  if (allowed && node.$ref?.startsWith("#/fields/") && !allowed.has(node.$ref.slice(9))) {
    return undefined;
  }
  const properties = Object.fromEntries(
    Object.entries(node.properties ?? {}).flatMap(([key, child]) => {
      const projected = projectNode(child, actions, allowed);
      return projected ? [[key, projected]] : [];
    }),
  );
  return {
    ...node,
    properties: node.properties ? properties : undefined,
    slots: projectSlots(node.slots, actions, allowed),
  };
}

/** Reads one scalar relation value from persisted or expanded records. */
function scalarRelationValue(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    const candidate = (value as { value?: unknown }).value;
    return typeof candidate === "string" && candidate ? candidate : undefined;
  }
  return undefined;
}

/** Reads unique relation values from scalar and multi-value records. */
function relationValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values.flatMap((item) => {
        const relation = scalarRelationValue(item);
        return relation ? [relation] : [];
      }),
    ),
  ];
}

/** Merges valid persisted permissions into the effective grant map. */
function mergePermissions(output: Map<string, PermissionGrant>, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Partial<PersistedPermission>;
    if (
      typeof candidate.model !== "string" ||
      !Array.isArray(candidate.actions) ||
      !Array.isArray(candidate.fields) ||
      (candidate.scope !== "all" && candidate.scope !== "own")
    ) {
      continue;
    }
    const current = output.get(candidate.model);
    const actions = new Set(current?.actions);
    const fields = new Set(current?.fields);
    for (const action of candidate.actions) {
      if (ACTIONS.has(action)) actions.add(action);
    }
    for (const field of candidate.fields) {
      if (typeof field === "string") fields.add(field);
    }
    output.set(candidate.model, {
      actions,
      fields,
      scope: current?.scope === "all" || candidate.scope === "all" ? "all" : "own",
    });
  }
}

/** Resolves hierarchical model, action, field, and data-scope access. */
export class AuthorizationService {
  constructor(
    private readonly models: ModelStore,
    private readonly records: RecordStore,
  ) {}

  async profile(actorId: string): Promise<AccessProfile> {
    if (actorId === SYS_ADMIN_ID) {
      return {
        actorId,
        roleIds: [SYS_ROLE_SUPER_ADMIN_ID],
        permissions: new Map(),
        canCreateModel: true,
        super: true,
      };
    }
    const [userSchema, roleSchema] = await Promise.all([
      this.models.get(SYS_USER_MODEL),
      this.models.get(SYS_ROLE_MODEL),
    ]);
    const user = userSchema ? await this.records.get(userSchema, actorId) : undefined;
    const roleIds = relationValues(user?.roleId);
    if (!roleSchema || roleIds.length === 0) {
      return {
        actorId,
        roleIds: [],
        permissions: new Map(),
        canCreateModel: false,
        super: false,
      };
    }
    if (roleIds.includes(SYS_ROLE_SUPER_ADMIN_ID)) {
      return { actorId, roleIds, permissions: new Map(), canCreateModel: true, super: true };
    }

    const roles = await this.records.subtree(roleSchema, {
      idField: "id",
      parentField: "parentId",
    });
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const children = new Map<string, ModelRecord[]>();
    for (const role of roles) {
      const parentId = scalarRelationValue(role.parentId);
      if (!parentId) continue;
      const siblings = children.get(parentId) ?? [];
      siblings.push(role);
      children.set(parentId, siblings);
    }

    const permissions = new Map<string, PermissionGrant>();
    let canCreateModel = false;
    const queue = [...roleIds];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const role = rolesById.get(currentId);
      if (!role) continue;
      canCreateModel ||= role.canCreateModel === true;
      mergePermissions(permissions, role.permissions);
      for (const child of children.get(currentId) ?? []) queue.push(child.id);
    }
    return { actorId, roleIds, permissions, canCreateModel, super: false };
  }

  /** Returns the effective data scope for one record action. */
  scope(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
    action: PermissionAction,
  ): PermissionScope | undefined {
    if (profile.super) return "all";
    if (action === "read" && model.name === SYS_MODEL_TAB_MODEL) return "all";
    if (profile.canCreateModel && model.creatorId === profile.actorId) return "all";
    const grant = profile.permissions.get(model.name);
    return grant?.actions.has(action) ? grant.scope : undefined;
  }

  /** Returns whether an actor may see a model at all. */
  canRead(profile: AccessProfile, model: Pick<AlienSchema, "name" | "creatorId">): boolean {
    return this.scope(profile, model, "read") !== undefined;
  }

  /** Throws when the actor cannot create a business model. */
  assertCanCreateModel(profile: AccessProfile): void {
    if (!profile.canCreateModel) throw forbidden("当前角色无权创建模型");
  }

  /** Throws when the actor cannot manage a model definition. */
  assertCanManageModel(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
  ): void {
    if (!profile.super && (!profile.canCreateModel || model.creatorId !== profile.actorId)) {
      throw forbidden(`无权修改模型：${model.name}`);
    }
  }

  /** Throws when the actor cannot perform an action on model records. */
  assertCan(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
    action: PermissionAction,
  ): PermissionScope {
    const scope = this.scope(profile, model, action);
    if (!scope) throw forbidden(`无权${action === "read" ? "查看" : "操作"}模型：${model.name}`);
    return scope;
  }

  /** Throws when submitted fields exceed the action's field grant. */
  assertFields(
    profile: AccessProfile,
    model: AlienSchema,
    action: PermissionAction,
    fields: Iterable<string>,
  ): void {
    if (profile.super || (profile.canCreateModel && model.creatorId === profile.actorId)) {
      return;
    }
    const allowed = profile.permissions.get(model.name)?.fields ?? new Set<string>();
    for (const field of fields) {
      if (!["id", "createdAt", "updatedAt"].includes(field) && !allowed.has(field)) {
        throw forbidden(`无权修改字段：${field}`);
      }
    }
    this.assertCan(profile, model, action);
  }

  /** Removes fields not granted by the effective role permissions. */
  project(profile: AccessProfile, model: AlienSchema, record: ModelRecord): ModelRecord {
    if (
      profile.super ||
      model.name === SYS_MODEL_TAB_MODEL ||
      (profile.canCreateModel && model.creatorId === profile.actorId)
    ) {
      return record;
    }
    const allowed = profile.permissions.get(model.name)?.fields;
    if (!allowed) return { id: record.id };
    const output: ModelRecord = { id: record.id };
    for (const key of ["createdAt", "updatedAt", ...allowed]) {
      if (key in record) output[key] = record[key];
    }
    return output;
  }

  /** Restricts a schema to granted fields and pages before rendering or query compilation. */
  projectSchema(profile: AccessProfile, model: AlienSchema): AlienSchema {
    if (
      profile.super ||
      model.name === SYS_MODEL_TAB_MODEL ||
      (profile.canCreateModel && model.creatorId === profile.actorId)
    ) {
      return model;
    }
    const grant = profile.permissions.get(model.name);
    const allowed = new Set(["id", "createdAt", "updatedAt", ...(grant?.fields ?? [])]);
    const actions = grant?.actions ?? new Set<PermissionAction>();
    return {
      ...model,
      fields: model.fields.filter((field) => allowed.has(field.key)),
      form: projectNode(model.form, actions, allowed) ?? { type: "object", properties: {} },
      pages: model.pages
        .filter((page) => actions.has(page.permission))
        .flatMap((page) => {
          const projected = projectNode(page, actions, allowed);
          return projected ? [projected as typeof page] : [];
        }),
    };
  }
}
