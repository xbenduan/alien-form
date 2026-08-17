/**
 * 本地 mock 接口边界。
 * 页面和 hooks 只依赖这些异步函数，替换成真实 service 时无需改 UI。
 */
export {
  listSchemas,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  batchDeleteRecords,
} from "../data";

export type {
  CmsModelSchema,
  ModelRecord,
  SchemaListFilters,
} from "../data";
