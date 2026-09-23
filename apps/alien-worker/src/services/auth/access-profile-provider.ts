import type { ModelRecord, PermissionAction } from "@alien-form/protocol";
import type { ModelStore } from "../../store/model-store.ts";
import type { RecordStore } from "../../store/record-store.ts";
import type {
  AccessProfile,
  AccessProfileProvider,
  PermissionGrant,
  PermissionScope,
} from "../core/access-control.ts";
import roleModule from "../models/_sys_role/index.ts";
import userModule from "../models/_sys_user/index.ts";

interface PersistedPermission {
  model: string;
  actions: PermissionAction[];
  fields: string[];
  scope: PermissionScope;
}

const ACTIONS = new Set<PermissionAction>(["read", "create", "update", "delete"]);

function scalarRelationValue(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    const candidate = (value as { value?: unknown }).value;
    return typeof candidate === "string" && candidate ? candidate : undefined;
  }
  return undefined;
}

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

/** 从系统用户与角色模型解析不可变的操作者权限档案。 */
export class RoleAccessProfileProvider implements AccessProfileProvider {
  constructor(
    private readonly models: ModelStore,
    private readonly records: RecordStore,
  ) {}

  async profile(actorId: string): Promise<AccessProfile> {
    if (actorId === userModule.constants.adminId) {
      return {
        actorId,
        roleIds: [roleModule.constants.superAdminId],
        permissions: new Map(),
        canCreateModel: true,
        super: true,
      };
    }
    const [userSchema, roleSchema] = await Promise.all([
      this.models.get(userModule.schema.name),
      this.models.get(roleModule.schema.name),
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
    if (roleIds.includes(roleModule.constants.superAdminId)) {
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
}
