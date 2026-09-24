/**
 * Generated from models/{modelCode}/index.ts files.
 * Run `pnpm generate:worker-models` after adding or removing a model module.
 */
export const MODEL_MODULE_LOADERS = {
  _sys_model_category: () => import("../models/_sys_model_category/index.ts"),
  _sys_role: () => import("../models/_sys_role/index.ts"),
  _sys_user: () => import("../models/_sys_user/index.ts"),
} as const;
