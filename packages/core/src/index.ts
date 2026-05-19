/**
 * @alien-form/core — Main entry point
 */

// Form & Field
export { createForm, Form } from "./form/index";
export { Field } from "./field/index";

// Types
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldValue,
  FieldState,
  ValidateStatus,
  FieldMutableState,
  SchemaXRuleType,
  SchemaReactionKey,
  SchemaXRule,
  SchemaRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  DataSourcePolicy,
  RuntimeRuleHandlerContext,
  RuntimeRuleHandler,
  FormLifecycleEvent,
  FormLifecycleHandler,
  SchemaTypes,
  FieldPatternTypes,
  FieldDisplayTypes,
  ValidatorFormats,
  Validator,
  ValidatorFn,
  ValidatorRule,
  FormConfig,
  FormError,
  FormErrorScope,
} from "./types";
