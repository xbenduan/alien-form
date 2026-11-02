import { escapePointer } from "formwork/model";
import type { ModelDefinition, DataSchema, StorageBinding } from "formwork/model";

function definition(
  id: string,
  title: string,
  table: string,
  properties: Record<string, DataSchema>,
  required: string[],
  rules: string[],
): ModelDefinition {
  const bindings: StorageBinding[] = Object.entries(properties).map(([key, schema]) => ({
    id: `${id}:${key}`,
    path: `/${escapePointer(key)}`,
    ...(key === "password" ? { jsonKey: key } : { column: key }),
    sqlType: "type" in schema && schema.type === "boolean" ? "INTEGER" : "TEXT",
    encoding:
      "type" in schema && (schema.type === "array" || schema.type === "object") ? "json" : "scalar",
    ...(["username", "code"].includes(key) ? { index: "unique" as const } : {}),
  }));
  return {
    document: {
      id,
      title,
      data: { type: "object", properties, required, additionalProperties: false },
    },
    backend: {
      storage: { table, bindings },
      relations: [],
      permissions: {
        grants: [],
        privateFields: id === "system-users" ? [`${id}:passwordHash`] : [],
      },
      behavior: { rules, commands: {}, events: {} },
    },
  };
}

const roles = definition(
  "system-roles",
  "角色管理",
  "sys_roles",
  {
    code: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    parentId: { type: ["string", "null"] },
    canCreateModel: { type: "boolean", default: false },
  },
  ["code", "name"],
  ["system.roles"],
);
roles.backend.relations = [
  {
    fieldId: "system-roles:parentId",
    targetModel: "system-roles",
    targetFieldId: "id",
    kind: "many-to-one",
  },
];
const users = definition(
  "system-users",
  "用户管理",
  "sys_users",
  {
    username: { type: "string", minLength: 1 },
    password: { type: "string", title: "密码", description: "留空保持原密码" },
    passwordHash: { type: "string", readOnly: true },
    roleId: { type: "array", items: { type: "string" }, minItems: 1 },
  },
  ["username", "passwordHash", "roleId"],
  ["system.password", "system.users"],
);
users.backend.relations = [
  {
    fieldId: "system-users:roleId",
    targetModel: "system-roles",
    targetFieldId: "id",
    kind: "many-to-many",
    through: "sys_user_roles",
  },
];
const categories = definition(
  "system-model-categories",
  "模型分类",
  "sys_model_categories",
  {
    code: { type: "string" },
    name: { type: "string" },
    aggregate: { type: "boolean", default: false },
  },
  ["code", "name", "aggregate"],
  ["system.categories"],
);

/** 声明由 service 代码维护并随部署初始化的系统模型。 */
export const systemModels: readonly ModelDefinition[] = [roles, users, categories];

/** 判断模型是否由系统代码固定定义。 */
export function isSystemModel(id: string): boolean {
  return systemModels.some((model) => model.document.id === id);
}
