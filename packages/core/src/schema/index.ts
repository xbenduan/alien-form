/**
 * @alien-form/core — Schema layer (pure types + pure functions, zero alien-signals dependency)
 */

// Types
export type {
  ValidateStatus,
  SchemaTypes,
  FieldDisplayTypes,
  ValidatorFormats,
  FieldError,
  SchemaReactionKey,
  SchemaXRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  FieldMutableState,
  IField,
  IFieldSchema,
  DataSourcePolicy,
  IFormSchema,
  FormConfig,
  FormErrorScope,
  FormError,
  EffectOptions,
  EffectContext,
  IForm,
  RuntimeRuleHandlerContext,
  RuntimeRuleHandler,
} from "./types";

// Expression parser
export { evaluateExpression } from "./expression";

// Validation (pure)
export {
  isEmptyValue,
  normalizeDataSource,
  normalizeValidationErrors,
} from "./validation";

// Path utilities
export { getDeepValue, setDeepValue, sortByOrder, isVoidField } from "./path";

// Schema normalization
export { getArrayItemSchema, isArrayFieldSchema } from "./normalize";

// Schema ref resolution
export { resolveSchemaRef } from "./ref-resolve";
export type { ResolveRefResult } from "./ref-resolve";
