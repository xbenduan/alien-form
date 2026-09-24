import { forbidden } from "../../../errors.ts";
import { defineModel } from "../../define-model.ts";
import { initialize } from "./database.ts";
import createSchema from "./schema.ts";
import userModule from "../_sys_user/index.ts";

export default defineModel(() => {
  const constants = {
    code: "_sys_model_category",
    allId: "SYSCATEGORY000001",
    systemId: "SYSCATEGORY000002",
    otherId: "SYSCATEGORY000003",
  } as const;
  const requiredCategoryIds = new Set<string>([
    constants.allId,
    constants.systemId,
    constants.otherId,
  ]);

  return {
    schema: createSchema(constants.code),
    constants,
    database: {
      initialize: (context) => initialize(context, constants, userModule.constants.adminId),
    },
    middleware: {
      validate({ record, previous }) {
        const code = record.code;
        if (typeof code !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(code)) {
          throw new Error("分类标识不合法");
        }
        if (previous && requiredCategoryIds.has(record.id) && code !== previous.code) {
          throw forbidden("系统预置分类标识不可修改");
        }
        if (typeof record.name !== "string" || record.name.trim() === "") {
          throw new Error("分类名称不能为空");
        }
        if (record.id === constants.allId && record.aggregate !== true) {
          throw forbidden("“全部”必须保持为聚合分类");
        }
        if (
          (record.id === constants.systemId || record.id === constants.otherId) &&
          record.aggregate === true
        ) {
          throw forbidden("“系统”和“其他”不能设为聚合分类");
        }
      },
      beforePersist({ operation, record }) {
        if (operation === "delete" && requiredCategoryIds.has(record.id)) {
          throw forbidden("系统预置分类不可删除");
        }
      },
    },
  };
});
