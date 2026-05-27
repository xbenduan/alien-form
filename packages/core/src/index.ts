/**
 * @alien-form/core — Main entry point
 */

// Form
export { createForm } from "./engine/form/index";

// Internals (for testing only)
export { getFormInternals } from "./engine/form/internals";

// Types — only expose what consumers actually need
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldMutableState,
  ValidateStatus,
  FieldDisplayTypes,
  FormConfig,
  FormError,
  EffectOptions,
  EffectContext,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  DataSourcePolicy,
  SchemaTypes,
} from "./schema/types";
