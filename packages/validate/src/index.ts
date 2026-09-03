/**
 * @alien-form/validate —— 前后端共享的协议类型与 zod 校验单一真源。
 *
 * BuilderSchema（对齐 canonical schema.tsx）的类型定义与校验都出自此包，
 * 供 alien-server / alien-worker / alien-mdm 共同使用。
 */

export {
  fieldSchema,
  fieldGroupSchema,
  displaySchema,
  type FieldSchema,
  type FieldGroup,
} from "./field-schema.ts";

export {
  builderSchemaSchema,
  builderMetaSchema,
  databaseFieldSchema,
  databaseRelationSchema,
  xPageSchema,
  databaseColumnType,
  databaseValueType,
  databaseRelationKind,
  openMode,
  type BuilderSchema,
  type BuilderMeta,
  type DatabaseField,
  type DatabaseRelation,
  type DatabaseColumnType,
  type DatabaseValueType,
  type DatabaseRelationKind,
  type OpenMode,
  type XPage,
} from "./builder-schema.ts";

export {
  assertBuilderSchema,
  parseBuilderSchema,
  formProperties,
  databaseFields,
  valueType,
} from "./assert.ts";

export {
  type ModelRecord,
  type Pagination,
  type Sorter,
  type DataSourceItem,
  type PluginMarker,
  isPluginMarker,
} from "./runtime-types.ts";
