import { computed, signal, effectScope } from "alien-signals";
import type {
  FormConfig,
  FormError,
  IField,
  IFieldSchema,
  IForm,
  IFormSchema,
  SchemaFormat,
} from "../../schema/types";

// ─── Symbol ──────────────────────────────────────────────────────────────────

export const FORM_INTERNALS = Symbol("alien-form.form-internals");

// ─── Types ───────────────────────────────────────────────────────────────────

type SignalValue<T> = ReturnType<typeof signal<T>>;

export interface FormInternals {
  form: IForm;
  fields: Map<string, IField>;
  config: FormConfig;
  initialValues: Record<string, any>;
  schema: IFormSchema | null;
  definitions: Record<string, IFieldSchema>;
  scope: Record<string, any>;
  fieldFormats: Map<string, SchemaFormat>;
  formattingValuePaths: Set<string>;
  errorListeners: Set<(error: FormError) => void>;
  installedRuleEffects: Map<string, () => void>;
  asyncReactionVersions: Map<string, number>;
  fieldLoadingCounts: Map<string, number>;
  reactionRunCounts: Map<string, number>;
  reactionExecutionStack: Set<string>;
  reactionRunResetQueued: boolean;
  // Signals
  version: SignalValue<number>;
  fieldRegistryVersion: SignalValue<number>;
  submitting: SignalValue<boolean>;
  // Computed caches (alien-signals native)
  valuesComputed: (() => Record<string, any>) | null;
  rawValuesComputed: (() => Record<string, any>) | null;
  // Scope management
  scopeDispose: (() => void) | null;
  destroyed: boolean;
}

export function createFormInternals(form: IForm, config: FormConfig = {}): FormInternals {
  return {
    form,
    fields: new Map(),
    config,
    initialValues: config.initialValues ? { ...config.initialValues } : {},
    schema: null,
    definitions: {},
    scope: config.scope || {},
    fieldFormats: new Map(),
    formattingValuePaths: new Set(),
    errorListeners: new Set(config.onError ? [config.onError] : []),
    installedRuleEffects: new Map(),
    asyncReactionVersions: new Map(),
    fieldLoadingCounts: new Map(),
    reactionRunCounts: new Map(),
    reactionExecutionStack: new Set(),
    reactionRunResetQueued: false,
    version: signal(0),
    fieldRegistryVersion: signal(0),
    submitting: signal(false),
    valuesComputed: null,
    rawValuesComputed: null,
    scopeDispose: null,
    destroyed: false,
  };
}

export function attachFormInternals(target: IForm, internals: FormInternals): void {
  internals.form = target;
  Object.defineProperty(target as object, FORM_INTERNALS, {
    value: internals,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export function getFormInternals(form: IForm): FormInternals {
  return (form as any)[FORM_INTERNALS] as FormInternals;
}
