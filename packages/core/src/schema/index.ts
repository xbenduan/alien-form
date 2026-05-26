/**
 * @alien-form/core — Schema layer (pure types + pure functions, zero alien-signals dependency)
 */

// Types
export type {
  FieldValue,
  FieldState,
  ValidateStatus,
  SchemaTypes,
  FieldPatternTypes,
  FieldDisplayTypes,
  ValidatorFormats,
  FieldError,
  ValidatorFn,
  Validator,
  ValidatorRule,
  SchemaXRuleType,
  SchemaReactionKey,
  SchemaXRule,
  SchemaRule,
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
  normalizeValidators,
  schemaValidators,
  applyValidatorRule,
  normalizeValidationErrors,
  validateFormat,
} from "./validation";

// Path utilities
export { getDeepValue, setDeepValue, sortByOrder, isVoidField } from "./path";

// Schema normalization
export { getArrayItemSchema, isArrayFieldSchema } from "./normalize";
