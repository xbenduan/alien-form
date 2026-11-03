import { compileDefinition } from "formwork/model";
import type { ModelDefinition, FieldSchema } from "formwork/model";

function definition(
  id: string,
  title: string,
  table: string,
  data: Record<string, FieldSchema>,
  rules: string[],
): ModelDefinition {
  return {
    schemaVersion: 1,
    id,
    title,
    data: Object.fromEntries(
      Object.entries(data).map(([key, schema]) => [
        key,
        {
          ...schema,
          id: `${id}:${key}`,
          storage: {
            ...(key === "password" ? { jsonKey: key } : { column: key }),
            ...(["username", "code"].includes(key) ? { index: "unique" as const } : {}),
            ...schema.storage,
          },
        },
      ]),
    ),
    backend: {
      storage: { table },
      permissions: {
        grants: [],
        privateFields: id === "system-users" ? [`${id}:passwordHash`] : [],
      },
      behavior: { rules },
    },
  };
}

const roles = definition(
  "system-roles",
  "角色管理",
  "sys_roles",
  {
    code: { type: "string", title: "标识", minLength: 1, required: true },
    name: { type: "string", title: "名称", minLength: 1, required: true },
    parentId: {
      type: "string",
      title: "父级角色",
      nullable: true,
      relation: { model: "system-roles" },
    },
    canCreateModel: { type: "boolean", title: "允许创建模型", default: false },
  },
  ["system.roles"],
);
roles.tree = { parentField: "/parentId", labelField: "/name" };
const users = definition(
  "system-users",
  "用户管理",
  "sys_users",
  {
    username: { type: "string", title: "用户名", minLength: 1, required: true },
    password: {
      type: "string",
      title: "密码",
      description: "留空保持原密码",
      ui: { table: false, filter: false, detail: false },
    },
    passwordHash: { type: "string", readOnly: true, required: true },
    roleId: {
      type: "array",
      title: "角色",
      format: "strings",
      minItems: 1,
      required: true,
      relation: { model: "system-roles" },
      storage: { through: "sys_user_roles" },
    },
  },
  ["system.password", "system.users"],
);
const categories = definition(
  "system-model-categories",
  "模型分类",
  "sys_model_categories",
  {
    code: { type: "string", title: "标识", required: true },
    name: { type: "string", title: "名称", required: true },
    aggregate: { type: "boolean", title: "聚合分类", default: false, required: true },
  },
  ["system.categories"],
);

/** 声明系统模型的唯一字段协议，派生绑定仅用于持久化执行。 */
export const systemDefinitions: readonly ModelDefinition[] = [roles, users, categories];
/** 为初始化和系统同步编译稳定字段绑定。 */
export const systemModels = systemDefinitions.map((schema) => compileDefinition(schema));

/** 判断模型是否由系统代码固定定义。 */
export function isSystemModel(id: string): boolean {
  return systemDefinitions.some((model) => model.id === id);
}
