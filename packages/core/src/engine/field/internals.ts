import { signal } from "alien-signals";
import type {
  DataSourcePolicy,
  FieldDisplayTypes,
  FieldError,
  FieldPatternTypes,
  IField,
  IFieldSchema,
  SchemaXValidate,
  ValidateStatus,
  Validator,
} from "../../schema/types";
import { createArrayFieldController, type ArrayFieldController } from "./array-controller";
import { normalizeDataSource, normalizeValidators, schemaValidators } from "./validation";
import { getArrayItemSchema, isArrayFieldSchema } from "../../schema/normalize";

// ─── Symbol ──────────────────────────────────────────────────────────────────

export const FIELD_INTERNALS = Symbol("alien-form.field-internals");

// ─── Signal type alias ───────────────────────────────────────────────────────

type SignalValue<T> = ReturnType<typeof signal<T>>;

// ─── Field Host interface (form-side contract) ───────────────────────────────

export interface FieldHost {
  fields: Map<string, IField>;
  getField(path: string): IField | undefined;
  createField(path: string, schema: IFieldSchema, initialValue?: any): IField;
  _createFieldTree?(
    path: string,
    schema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ): void;
  _notifyFieldChange?(path: string, field: IField): void;
  _notifyFieldValueChange?(path: string, field: IField): void;
  _notifyFieldStructureChange?(): void;
  _notifyFieldValidateStart?(path: string, field: IField): void;
  _notifyFieldValidateEnd?(path: string, field: IField): void;
  _notifyFieldValidateFailed?(path: string, field: IField): void;
  _notifyFieldValidateSuccess?(path: string, field: IField): void;
  _runXValidate?(field: IField, rules: SchemaXValidate, value: any): Promise<any[]>;
}

// ─── Signals bundle ──────────────────────────────────────────────────────────
//
// Signals are split into two groups:
// 1. Hot signals — frequently read/written at runtime (value, display, pattern, etc.)
// 2. Cold meta — a single signal holding rarely-changing metadata as a frozen object
//
// This reduces per-field memory overhead from ~20 signals to ~12 signals + 1 meta object.

export interface FieldMeta {
  title: string;
  description: string;
  component: string;
  componentProps: Record<string, any>;
  decorator: string;
  decoratorProps: Record<string, any>;
  data: Record<string, any>;
  content: any;
}

export interface FieldSignals {
  value: SignalValue<any>;
  display: SignalValue<FieldDisplayTypes>;
  pattern: SignalValue<FieldPatternTypes>;
  required: SignalValue<boolean>;
  errors: SignalValue<FieldError[]>;
  warnings: SignalValue<FieldError[]>;
  validateStatus: SignalValue<ValidateStatus>;
  dataSource: SignalValue<Array<{ label: string; value: any }>>;
  loading: SignalValue<boolean>;
  version: SignalValue<number>;
  arrayRows: SignalValue<number>;
  /** Rarely-changing metadata bundled into a single signal. */
  meta: SignalValue<FieldMeta>;
}

// ─── Field Internals ─────────────────────────────────────────────────────────

export interface FieldInternals {
  path: string;
  address: string;
  schema: IFieldSchema;
  signals: FieldSignals;
  initialValue: any;
  validators: Validator[];
  xValidate?: SchemaXValidate;
  dataSourcePolicy: string;
  isArrayField: boolean;
  itemSchema: IFieldSchema | null;
  arrayController: ArrayFieldController | null;
  form: FieldHost | null;
  reconcilingDataSourceValue: boolean;
  runtime: {
    connectForm(form: FieldHost): void;
    renamePath(newPath: string): void;
  };
}

export function createFieldInternals(
  path: string,
  schema: IFieldSchema,
  initialValue?: any,
): FieldInternals {
  const isArrayField = isArrayFieldSchema(schema);
  const itemSchema = getArrayItemSchema(schema);

  // Compute initial state
  const defaultValue = initialValue !== undefined ? initialValue : schema.default;
  const display: FieldDisplayTypes = schema.state?.display || "visible";
  const pattern: FieldPatternTypes =
    schema.state?.pattern ||
    (schema.state?.readPretty === true
      ? "readPretty"
      : schema.state?.readOnly === true
        ? "readOnly"
        : schema.state?.disabled === true
          ? "disabled"
          : schema.state?.editable === false
            ? "readOnly"
            : "editable");

  // Resolve required: schema.required (top-level) OR schema.validate.required
  const required =
    schema.required === true || schema.validate?.required === true;

  const signals: FieldSignals = {
    value: signal(isArrayField ? (Array.isArray(defaultValue) ? defaultValue : []) : defaultValue),
    display: signal<FieldDisplayTypes>(display),
    pattern: signal<FieldPatternTypes>(pattern),
    required: signal(required),
    errors: signal<FieldError[]>([]),
    warnings: signal<FieldError[]>([]),
    validateStatus: signal<ValidateStatus>(""),
    dataSource: signal(normalizeDataSource(schema.dataSource)),
    loading: signal(false),
    version: signal(0),
    arrayRows: signal(isArrayField ? (Array.isArray(defaultValue) ? defaultValue.length : 0) : 0),
    meta: signal<FieldMeta>({
      title: schema.title || "",
      description: schema.description || "",
      component: schema.component || "Input",
      componentProps: schema.props || {},
      decorator: schema.decorator || "FormItem",
      decoratorProps: schema.decoratorProps || {},
      data: schema.data || {},
      content: schema.content || null,
    }),
  };

  const internals: FieldInternals = {
    path,
    address: path,
    schema,
    signals,
    initialValue: defaultValue,
    validators: normalizeValidators([
      ...schemaValidators(schema),
      ...normalizeValidators(schema.validators),
    ]),
    xValidate: schema["x-validate"],
    dataSourcePolicy: schema.dataSourcePolicy || "preserve",
    isArrayField,
    itemSchema,
    arrayController: null,
    form: null,
    reconcilingDataSourceValue: false,
    runtime: {
      connectForm(form: FieldHost) {
        internals.form = form;
      },
      renamePath(newPath: string) {
        internals.path = newPath;
        internals.address = newPath;
      },
    },
  };

  internals.arrayController = isArrayField
    ? createArrayFieldController({
        path,
        itemSchema,
        getHost: () => internals.form,
        getRowCount: () => internals.signals.arrayRows(),
        setRowCount: (count) => internals.signals.arrayRows(count),
        setStoredValue: (value) => internals.signals.value(value),
      })
    : null;

  return internals;
}

export function attachFieldInternals(target: IField, internals: FieldInternals): void {
  Object.defineProperty(target as object, FIELD_INTERNALS, {
    value: internals,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export function getFieldInternals(field: IField): FieldInternals {
  return (field as any)[FIELD_INTERNALS] as FieldInternals;
}

export function renameFieldInternals(field: IField, newPath: string): void {
  getFieldInternals(field).runtime.renamePath(newPath);
}
