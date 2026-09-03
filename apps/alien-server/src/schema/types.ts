/**
 * 后端协议类型 —— 现在统一出自 @alien-form/validate（zod 单一真源）。
 *
 * 本文件仅做「后端命名别名 + 运行时辅助」的再导出层：
 *   BuilderSchema → ModelSchema、XPage → Page、FieldSchema → ModelFieldSchema、
 *   DatabaseColumnType → ColumnType、assertBuilderSchema → assertModelSchema。
 * 类型定义与校验本体均来自 packages/validate。
 */

export type {
  BuilderSchema as ModelSchema,
  BuilderMeta as ModelMeta,
  FieldSchema as ModelFieldSchema,
  XPage as Page,
  DatabaseField,
  DatabaseRelation,
  DatabaseColumnType as ColumnType,
  DatabaseValueType,
  DatabaseRelationKind as RelationKind,
  OpenMode,
  FieldGroup,
  ModelRecord,
  Pagination,
  Sorter,
  DataSourceItem,
  PluginMarker,
} from "@alien-form/validate";

export {
  assertBuilderSchema as assertModelSchema,
  formProperties,
  databaseFields,
  valueType,
  isPluginMarker,
} from "@alien-form/validate";
