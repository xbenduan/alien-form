import { forbidden } from "../../errors.ts";
import {
  SYS_MODEL_TAB_ALL_ID,
  SYS_MODEL_TAB_MODEL,
  SYS_MODEL_TAB_OTHER_ID,
  SYS_MODEL_TAB_SYSTEM_ID,
  sysModelTabSchema,
} from "../../domain/schemas/_sys_model_tab.ts";
import type { ModelRegistry } from "../registry.ts";

/** IDs required by model navigation and default model assignment. */
const REQUIRED_TAB_IDS = new Set([
  SYS_MODEL_TAB_ALL_ID,
  SYS_MODEL_TAB_SYSTEM_ID,
  SYS_MODEL_TAB_OTHER_ID,
]);

/** Registers the model navigation tab model and protects its required records. */
export function registerSysModelTab(registry: ModelRegistry): void {
  registry.model(SYS_MODEL_TAB_MODEL, {
    schema: sysModelTabSchema,
    validators: {
      code(value, { record, previous }) {
        if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
          throw new Error("Tab 标识不合法");
        }
        if (previous && REQUIRED_TAB_IDS.has(record.id) && value !== previous.code) {
          throw forbidden("系统预置 Tab 标识不可修改");
        }
      },
      name(value) {
        if (typeof value !== "string" || value.trim() === "") {
          throw new Error("Tab 名称不能为空");
        }
      },
    },
    validate({ record }) {
      if (record.id === SYS_MODEL_TAB_ALL_ID && record.aggregate !== true) {
        throw forbidden("“全部”必须保持为聚合 Tab");
      }
      if (
        (record.id === SYS_MODEL_TAB_SYSTEM_ID || record.id === SYS_MODEL_TAB_OTHER_ID) &&
        record.aggregate === true
      ) {
        throw forbidden("“系统”和“其他”不能设为聚合 Tab");
      }
    },
    hooks: {
      beforeDelete({ record }) {
        if (REQUIRED_TAB_IDS.has(record.id)) throw forbidden("系统预置 Tab 不可删除");
      },
    },
  });
}
