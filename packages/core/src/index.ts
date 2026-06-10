/**
 * @alien-form/core — Main entry point
 * Value-capability runtime architecture
 */

export { createForm } from "./form";

// Re-export alien-signals primitives so downstream packages
// (like @alien-form/react) don't need to depend on alien-signals directly.
export { signal, computed, effect, startBatch, endBatch } from "alien-signals";

export type {
  Signal,
  Computed,
  FieldNode,
  FieldAtoms,
  BaseFieldNode,
  PrimitiveFieldNode,
  ObjectFieldNode,
  ArrayFieldNode,
  VoidFieldNode,
  RowNode,
  FieldKind,
  PrimitiveSchemaType,
  FormInstance,
  FormConfig,
  FormError,
  FormErrorScope,
  IFormSchema,
  IFieldSchema,
  FieldError,
  DataSourceItem,
  FieldDisplayTypes,
  ValidateStatus,
  SchemaTypes,
  DataSourcePolicy,
  SchemaRuntimeValue,
  SchemaEffect,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  SchemaReactionKey,
  RuntimeRuleHandler,
  RuntimeRuleContext,
} from "./types";

export { resolveSchemaRef, resolveSchemaTree } from "./ref-resolve";
export type { ResolveRefResult } from "./ref-resolve";
export { getDeepValue, setDeepValue, sortByOrder } from "./path";
export { evaluateExpression } from "./expression";
export { normalizeDataSource, isEmptyValue } from "./validation";
