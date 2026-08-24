import type { ModelSchema } from "../schema/types.ts";
import { schoolRoleSchema } from "./school-role.ts";
import { schoolUserSchema } from "./school-user.ts";
import { schoolDepartmentSchema } from "./school-department.ts";
import { schoolCourseSchema } from "./school-course.ts";

/**
 * 内置基础模型：role（权限）与 user（用户）写死，department（组织）与 course 建立其上。
 * 数组顺序即建表依赖顺序：先 role/user（被引用），再 department（引用 user 的班主任/创建者），
 * 最后 course（引用 user 的授课教师）。
 */
export const builtinSchemas: ModelSchema[] = [
  schoolRoleSchema,
  schoolUserSchema,
  schoolDepartmentSchema,
  schoolCourseSchema,
];

export { schoolRoleSchema, schoolUserSchema, schoolDepartmentSchema, schoolCourseSchema };
