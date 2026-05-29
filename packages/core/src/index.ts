/**
 * @alien-form/core — Main entry point
 * Atomic signal-per-property architecture
 */

export { createForm } from "./form";

// Re-export alien-signals primitives so downstream packages
// (like @alien-form/react) don't need to depend on alien-signals directly.
export { signal, computed, effect, startBatch, endBatch } from "alien-signals";

export type {
  // Signal types (defined locally since alien-signals doesn't export them)
  Signal,
  Computed,

  // Core atoms
  FieldAtoms,
  FormInstance,
  FormConfig,
  FormError,
  FormErrorScope,

  // Schema types
  IFormSchema,
  IFieldSchema,
  FieldError,
  DataSourceItem,
  FieldDisplayTypes,
  ValidateStatus,
  SchemaTypes,
  DataSourcePolicy,

  // Reaction types
  SchemaXRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  SchemaReactionKey,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  SchemaValidate,
} from "./types";

// Schema utilities
export { resolveSchemaRef, resolveSchemaTree } from "./ref-resolve";
export type { ResolveRefResult } from "./ref-resolve";
export { getDeepValue, setDeepValue, sortByOrder } from "./path";
export { evaluateExpression } from "./expression";
export { normalizeDataSource, isEmptyValue } from "./validation";
