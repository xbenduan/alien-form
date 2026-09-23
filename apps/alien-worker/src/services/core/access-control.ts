import type {
  AlienFieldSchema,
  AlienSchema,
  ModelRecord,
  PermissionAction,
} from "@alien-form/protocol";
import { forbidden } from "../../errors.ts";
import { publicRecord } from "./record-visibility.ts";

export type PermissionScope = "all" | "own";

export interface PermissionGrant {
  readonly actions: ReadonlySet<PermissionAction>;
  readonly fields: ReadonlySet<string>;
  readonly scope: PermissionScope;
}

export interface AccessProfile {
  readonly actorId: string;
  readonly roleIds: readonly string[];
  readonly permissions: ReadonlyMap<string, PermissionGrant>;
  readonly canCreateModel: boolean;
  readonly super: boolean;
}

/** 为 Core 提供当前操作者已经解析完成的权限档案。 */
export interface AccessProfileProvider {
  profile(actorId: string): Promise<AccessProfile>;
}

export interface AccessControlOptions {
  /** 无需角色授权即可读取的模型，由组合根显式声明。 */
  publicModelNames?: ReadonlySet<string>;
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

function projectDefinitions(
  definitions: AlienSchema["definitions"],
  actions: ReadonlySet<PermissionAction>,
  allowed: ReadonlySet<string>,
): AlienSchema["definitions"] {
  if (!definitions) return undefined;
  return Object.fromEntries(
    Object.entries(definitions).flatMap(([key, node]) => {
      const projected = projectNode(node, actions, allowed);
      return projected ? [[key, projected]] : [];
    }),
  );
}

/** Core 内不可绕过的权限决策与输出裁剪。 */
export class AccessControl {
  constructor(
    private readonly profiles: AccessProfileProvider,
    private readonly options: AccessControlOptions = {},
  ) {}

  profile(actorId: string): Promise<AccessProfile> {
    return this.profiles.profile(actorId);
  }

  /** 返回记录操作的有效数据范围。 */
  scope(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
    action: PermissionAction,
  ): PermissionScope | undefined {
    if (profile.super) return "all";
    if (action === "read" && this.options.publicModelNames?.has(model.name)) return "all";
    if (profile.canCreateModel && model.creatorId === profile.actorId) return "all";
    const grant = profile.permissions.get(model.name);
    return grant?.actions.has(action) ? grant.scope : undefined;
  }

  /** 返回操作者是否可以读取模型。 */
  canRead(profile: AccessProfile, model: Pick<AlienSchema, "name" | "creatorId">): boolean {
    return this.scope(profile, model, "read") !== undefined;
  }

  /** 断言操作者可以创建业务模型。 */
  assertCanCreateModel(profile: AccessProfile): void {
    if (!profile.canCreateModel) throw forbidden("当前角色无权创建模型");
  }

  /** 断言操作者可以管理模型定义。 */
  assertCanManageModel(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
  ): void {
    if (!profile.super && (!profile.canCreateModel || model.creatorId !== profile.actorId)) {
      throw forbidden(`无权修改模型：${model.name}`);
    }
  }

  /** 断言操作者可以执行指定记录操作。 */
  assertCan(
    profile: AccessProfile,
    model: Pick<AlienSchema, "name" | "creatorId">,
    action: PermissionAction,
  ): PermissionScope {
    const scope = this.scope(profile, model, action);
    if (!scope) throw forbidden(`无权${action === "read" ? "查看" : "操作"}模型：${model.name}`);
    return scope;
  }

  /** 断言提交字段没有超出操作权限。 */
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

  /** 按协议私有性和字段权限裁剪记录。 */
  project(profile: AccessProfile, model: AlienSchema, record: ModelRecord): ModelRecord {
    const visible = publicRecord(model, record);
    if (
      profile.super ||
      this.options.publicModelNames?.has(model.name) ||
      (profile.canCreateModel && model.creatorId === profile.actorId)
    ) {
      return visible;
    }
    const allowed = profile.permissions.get(model.name)?.fields;
    if (!allowed) return { id: visible.id };
    const output: ModelRecord = { id: visible.id };
    for (const key of ["createdAt", "updatedAt", ...allowed]) {
      if (key in visible) output[key] = visible[key];
    }
    return output;
  }

  /** 按协议私有性、字段权限和操作权限裁剪模型 Schema。 */
  projectSchema(profile: AccessProfile, model: AlienSchema): AlienSchema {
    const publicFields = model.fields.filter((field) => !field.private);
    const publicFieldKeys = new Set(publicFields.map((field) => field.key));
    if (
      profile.super ||
      this.options.publicModelNames?.has(model.name) ||
      (profile.canCreateModel && model.creatorId === profile.actorId)
    ) {
      return {
        ...model,
        fields: publicFields,
        form: projectNode(model.form, ACTIONS, publicFieldKeys) ?? {
          type: "object",
          properties: {},
        },
        definitions: projectDefinitions(model.definitions, ACTIONS, publicFieldKeys),
        pages: model.pages.flatMap((page) => {
          const projected = projectNode(page, ACTIONS, publicFieldKeys);
          return projected ? [projected as typeof page] : [];
        }),
      };
    }
    const grant = profile.permissions.get(model.name);
    const allowed = new Set(
      ["id", "createdAt", "updatedAt", ...(grant?.fields ?? [])].filter((key) =>
        publicFieldKeys.has(key),
      ),
    );
    const actions = grant?.actions ?? new Set<PermissionAction>();
    return {
      ...model,
      fields: publicFields.filter((field) => allowed.has(field.key)),
      form: projectNode(model.form, actions, allowed) ?? { type: "object", properties: {} },
      definitions: projectDefinitions(model.definitions, actions, allowed),
      pages: model.pages
        .filter((page) => actions.has(page.permission))
        .flatMap((page) => {
          const projected = projectNode(page, actions, allowed);
          return projected ? [projected as typeof page] : [];
        }),
    };
  }
}
