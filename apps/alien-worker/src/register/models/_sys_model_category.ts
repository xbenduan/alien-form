import { forbidden } from "../../errors.ts";
import {
  SYS_MODEL_CATEGORY_ALL_ID,
  SYS_MODEL_CATEGORY_MODEL,
  SYS_MODEL_CATEGORY_OTHER_ID,
  SYS_MODEL_CATEGORY_SYSTEM_ID,
  sysModelCategorySchema,
} from "../../domain/schemas/_sys_model_category.ts";
import type { ModelRegistry } from "../registry.ts";

/** IDs required by model classification and default model assignment. */
const REQUIRED_CATEGORY_IDS = new Set([
  SYS_MODEL_CATEGORY_ALL_ID,
  SYS_MODEL_CATEGORY_SYSTEM_ID,
  SYS_MODEL_CATEGORY_OTHER_ID,
]);

/** Registers the model category model and protects its required records. */
export function registerSysModelCategory(registry: ModelRegistry): void {
  registry.model(SYS_MODEL_CATEGORY_MODEL, {
    schema: sysModelCategorySchema,
    validators: {
      code(value, { record, previous }) {
        if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
          throw new Error("分类标识不合法");
        }
        if (previous && REQUIRED_CATEGORY_IDS.has(record.id) && value !== previous.code) {
          throw forbidden("系统预置分类标识不可修改");
        }
      },
      name(value) {
        if (typeof value !== "string" || value.trim() === "") {
          throw new Error("分类名称不能为空");
        }
      },
    },
    validate({ record }) {
      if (record.id === SYS_MODEL_CATEGORY_ALL_ID && record.aggregate !== true) {
        throw forbidden("“全部”必须保持为聚合分类");
      }
      if (
        (record.id === SYS_MODEL_CATEGORY_SYSTEM_ID || record.id === SYS_MODEL_CATEGORY_OTHER_ID) &&
        record.aggregate === true
      ) {
        throw forbidden("“系统”和“其他”不能设为聚合分类");
      }
    },
    hooks: {
      beforeDelete({ record }) {
        if (REQUIRED_CATEGORY_IDS.has(record.id)) throw forbidden("系统预置分类不可删除");
      },
    },
  });
}
