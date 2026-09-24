import { forbidden } from "@alien-form/alienbase";
import { defineModel } from "@alien-form/alienbase";
import { initialize } from "./database.ts";
import createSchema from "./schema.ts";
import userModule from "../_sys_user/index.ts";

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

export default defineModel({
  schema: createSchema(constants.code),
  constants,
  database: {
    initialize: (context) => initialize(context, constants, userModule.constants.adminId),
  },
  middleware: {
    validate({ record, previous }) {
      const code = record.code;
      if (previous && requiredCategoryIds.has(record.id) && code !== previous.code) {
        throw forbidden("系统预置分类标识不可修改");
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
});
