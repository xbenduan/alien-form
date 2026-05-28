/**
 * @alien-form/core — Main entry point
 */

// Form
export { createForm } from "./engine/form/index";

// Internals (for testing only)
export { getFormInternals } from "./engine/form/internals";

// Schema type utilities
export { define } from "./resolved";
export type {
  Resolved,
  InferRole,
  InferSlots,
  InferCustomProps,
  InferFieldsMap,
  FieldSlots,
  VoidSlots,
  ObjectSlots,
  ArraySlots,
  DecoratorSlots,
} from "./resolved";

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

// Schema ref resolution (pure, stateless)
export { resolveSchemaRef } from "./schema";
export type { ResolveRefResult } from "./schema";
