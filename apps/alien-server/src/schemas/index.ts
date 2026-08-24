import type { ModelSchema } from "../schema/types.ts";
import { schoolRoleSchema } from "./school-role.ts";
import { schoolUserSchema } from "./school-user.ts";
import { schoolCourseSchema } from "./school-course.ts";

/**
 * 内置基础模型：role（权限）与 user（用户）写死，course 建立其上。
 * 数组顺序即建表依赖顺序：先 role/user（被引用），再 course（引用者）。
 */
export const builtinSchemas: ModelSchema[] = [
  schoolRoleSchema,
  schoolUserSchema,
  schoolCourseSchema,
];

export { schoolRoleSchema, schoolUserSchema, schoolCourseSchema };
