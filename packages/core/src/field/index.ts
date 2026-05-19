/**
 * @alien-form/core — Field implementation using Alien Signals
 * Enterprise schema protocol inspired by Formily
 */

import { signal, effect, startBatch, endBatch } from "alien-signals";
import type {
  IField,
  FieldError,
  ValidateStatus,
  FieldMutableState,
  IFieldSchema,
  Validator,
  SchemaXValidate,
  DataSourcePolicy,
  FieldDisplayTypes,
  FieldPatternTypes,
} from "../types";
import {
  isEmptyValue,
  normalizeDataSource,
  normalizeValidators,
  runValidator,
  schemaValidators,
} from "./validation";
import { ArrayFieldController } from "./array-controller";
import { arrayShallowEqual } from "../utils/array";
import { getArrayItemSchema, isArrayFieldSchema } from "../utils/schema";

/**
 * Internal contract used by Field to talk back to its owning Form without
 * creating a circular module import. Form implements every member.
 */
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
  _rebuildReactions?(): void;
  _notifyFieldChange?(path: string, field: IField): void;
  _notifyFieldValueChange?(path: string, field: IField): void;
  _notifyFieldValidateStart?(path: string, field: IField): void;
  _notifyFieldValidateEnd?(path: string, field: IField): void;
  _notifyFieldValidateFailed?(path: string, field: IField): void;
  _notifyFieldValidateSuccess?(path: string, field: IField): void;
  _runXValidate?(
    field: IField,
    rules: SchemaXValidate,
    value: any,
  ): Promise<FieldError[]>;
}

export class Field implements IField {
  // Signals for reactive state
  private _value: ReturnType<typeof signal<any>>;
  private _initialValue: any;
  private _display: ReturnType<typeof signal<FieldDisplayTypes>>;
  private _pattern: ReturnType<typeof signal<FieldPatternTypes>>;
  private _required: ReturnType<typeof signal<boolean>>;
  private _errors: ReturnType<typeof signal<FieldError[]>>;
  private _warnings: ReturnType<typeof signal<FieldError[]>>;
  private _validateStatus: ReturnType<typeof signal<ValidateStatus>>;
  private _title: ReturnType<typeof signal<string>>;
  private _description: ReturnType<typeof signal<string>>;
  private _component: ReturnType<typeof signal<string>>;
  private _componentProps: ReturnType<typeof signal<Record<string, any>>>;
  private _decorator: ReturnType<typeof signal<string>>;
  private _decoratorProps: ReturnType<typeof signal<Record<string, any>>>;
  private _dataSource: ReturnType<
    typeof signal<Array<{ label: string; value: any }>>
  >;
  private _loading: ReturnType<typeof signal<boolean>>;
  private _data: ReturnType<typeof signal<Record<string, any>>>;
  private _content: ReturnType<typeof signal<any>>;

  readonly path: string;
  readonly address: string;
  private _validators: Validator[];
  private _xValidate?: SchemaXValidate;
  private _dataSourcePolicy: DataSourcePolicy;
  private _reconcilingDataSourceValue = false;
  private _listeners: Set<() => void> = new Set();
  private _version: ReturnType<typeof signal<number>>;

  // Array field support
  readonly isArrayField: boolean;
  private _itemSchema: IFieldSchema | null;
  private _arrayRows: ReturnType<typeof signal<number>>;
  private _arrayController: ArrayFieldController | null;
  // Structural reference to the owning form. Defined as an interface so we
  // don't import the Form class (which would create a circular import).
  private _form: FieldHost | null = null;

  constructor(path: string, schema: IFieldSchema, initialValue?: any) {
    this.path = path;
    this.address = path; // In flat model, address equals path

    // Treat any homogeneous array schema as an array field so object arrays and
    // primitive arrays share the same child-field lifecycle.
    this.isArrayField = isArrayFieldSchema(schema);
    this._itemSchema = getArrayItemSchema(schema);

    const defaultValue =
      initialValue !== undefined ? initialValue : schema.default;
    this._initialValue = defaultValue;

    this._value = signal(
      this.isArrayField
        ? Array.isArray(defaultValue)
          ? defaultValue
          : []
        : defaultValue,
    );

    // Display is defined explicitly through state.display.
    const display: FieldDisplayTypes = schema.state?.display || "visible";
    this._display = signal<FieldDisplayTypes>(display);

    // Pattern: editable | readOnly | disabled | readPretty
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
    this._pattern = signal<FieldPatternTypes>(pattern);

    this._required = signal(schema.required === true);
    this._errors = signal<FieldError[]>([]);
    this._warnings = signal<FieldError[]>([]);
    this._validateStatus = signal<ValidateStatus>("");
    this._title = signal(schema.title || "");
    this._description = signal(schema.description || "");
    this._component = signal(schema.component || "Input");
    this._componentProps = signal(schema.props || {});
    this._decorator = signal(schema.decorator || "FormItem");
    this._decoratorProps = signal(schema.decoratorProps || {});
    this._dataSource = signal(normalizeDataSource(schema.dataSource));
    this._dataSourcePolicy = schema.dataSourcePolicy || "preserve";
    this._loading = signal(false);
    this._data = signal(schema.data || {});
    this._content = signal(schema.content || null);
    this._validators = normalizeValidators([
      ...schemaValidators(schema),
      ...normalizeValidators(schema.validators),
    ]);
    this._xValidate = schema["x-validate"];
    this._version = signal(0);
    this._arrayRows = signal(
      this.isArrayField
        ? Array.isArray(defaultValue)
          ? defaultValue.length
          : 0
        : 0,
    );
    this._arrayController = this.isArrayField
      ? new ArrayFieldController({
          path: this.path,
          itemSchema: this._itemSchema,
          getHost: () => this._form,
          getRowCount: () => this._arrayRows(),
          setRowCount: (count) => this._arrayRows(count),
          setStoredValue: (value) => this._value(value),
        })
      : null;
  }

  // Set form reference (called by Form after creating the field)
  _setForm(form: FieldHost) {
    this._form = form;
  }

  // ============================================================
  // Getters — read signals
  // ============================================================

  get value() {
    if (this.isArrayField && this._arrayController) {
      return this._arrayController.collectValue(this._value());
    }
    return this._value();
  }

  get initialValue() {
    return this._initialValue;
  }

  // Display types
  get display(): FieldDisplayTypes {
    return this._display();
  }
  get visible(): boolean {
    return this._display() !== "none";
  }
  get hidden(): boolean {
    return this._display() === "hidden";
  }

  // Pattern types
  get pattern(): FieldPatternTypes {
    return this._pattern();
  }
  get disabled(): boolean {
    return this._pattern() === "disabled";
  }
  get readOnly(): boolean {
    return this._pattern() === "readOnly";
  }
  get readPretty(): boolean {
    return this._pattern() === "readPretty";
  }
  get editable(): boolean {
    return this._pattern() === "editable";
  }

  get required() {
    return this._required();
  }
  get errors() {
    return this._errors();
  }
  get warnings() {
    return this._warnings();
  }
  get validateStatus() {
    return this._validateStatus();
  }
  get title() {
    return this._title();
  }
  get description() {
    return this._description();
  }
  get component() {
    return this._component();
  }
  get componentProps() {
    return this._componentProps();
  }
  get decorator() {
    return this._decorator();
  }
  get decoratorProps() {
    return this._decoratorProps();
  }
  get dataSource() {
    return this._dataSource();
  }
  get loading() {
    return this._loading();
  }
  get data() {
    return this._data();
  }
  get content() {
    return this._content();
  }

  get arrayItems(): IField[][] {
    return this._arrayController?.getItems() || [];
  }

  // ============================================================
  // Setters — write signals
  // ============================================================

  setValue(value: any): void {
    if (this.isArrayField && this._form && this._itemSchema) {
      this._setArrayValue(Array.isArray(value) ? value : []);
      return;
    }
    if (Object.is(this._value(), value)) return;
    this._value(value);
    this._bumpVersion();
    this._notifyValueChange();
  }

  setErrors(errors: FieldError[]): void {
    this._errors(errors);
    this._validateStatus(errors.length > 0 ? "error" : "success");
    this._bumpVersion();
  }

  setWarnings(warnings: FieldError[]): void {
    this._warnings(warnings);
    this._bumpVersion();
  }

  setDataSource(
    ds: Array<{ label: string; value: any; [key: string]: any }>,
  ): void {
    this._dataSource(normalizeDataSource(ds));
    this._reconcileValueWithDataSource();
    this._bumpVersion();
  }

  private _reconcileValueWithDataSource(): void {
    if (this._reconcilingDataSourceValue) return;

    const policy = this._dataSourcePolicy || "preserve";
    if (policy === "preserve") return;

    const dataSource = this._dataSource();
    if (dataSource.length === 0) return;

    const validValues = new Set(dataSource.map((item) => item.value));
    const current = this.value;

    this._reconcilingDataSourceValue = true;
    try {
      if (Array.isArray(current)) {
        if (policy === "filter" || policy === "clear") {
          const next = current.filter((item) => validValues.has(item));
          if (!arrayShallowEqual(next, current)) {
            this._value(next);
            this._notifyValueChange();
          }
        }
        return;
      }

      if (current === undefined || current === null || current === "") return;
      if (validValues.has(current)) return;

      if (policy === "clear" || policy === "filter") {
        this._value(undefined);
        this._notifyValueChange();
      } else if (policy === "first") {
        this._value(dataSource[0]?.value);
        this._notifyValueChange();
      }
    } finally {
      this._reconcilingDataSourceValue = false;
    }
  }

  setLoading(loading: boolean): void {
    if (this._loading() === loading) return;
    this._loading(loading);
    this._bumpVersion();
  }

  setDisplay(display: FieldDisplayTypes): void {
    if (this._display() === display) return;
    this._display(display);
    this._bumpVersion();
  }

  setPattern(pattern: FieldPatternTypes): void {
    if (this._pattern() === pattern) return;
    this._pattern(pattern);
    this._bumpVersion();
  }

  setComponent(component: string, props?: Record<string, any>): void {
    startBatch();
    this._component(component);
    if (props !== undefined) {
      this._componentProps(props);
    }
    this._bumpVersion();
    endBatch();
  }

  setDecorator(decorator: string, props?: Record<string, any>): void {
    startBatch();
    this._decorator(decorator);
    if (props !== undefined) {
      this._decoratorProps(props);
    }
    this._bumpVersion();
    endBatch();
  }

  setState(state: Partial<FieldMutableState>): void {
    startBatch();
    if ("value" in state) {
      if (this.isArrayField && Array.isArray(state.value)) {
        this._arrayController?.setValue(state.value);
      } else {
        this._value(state.value);
      }
    }
    if ("visible" in state) {
      this._display(state.visible ? "visible" : "none");
    }
    if ("hidden" in state) {
      if (state.hidden) this._display("hidden");
      else if (this._display() === "hidden") this._display("visible");
    }
    if ("display" in state) this._display(state.display!);
    if ("pattern" in state) this._pattern(state.pattern!);
    if ("disabled" in state) {
      if (state.disabled) this._pattern("disabled");
      else if (this._pattern() === "disabled") this._pattern("editable");
    }
    if ("readOnly" in state) {
      if (state.readOnly) this._pattern("readOnly");
      else if (this._pattern() === "readOnly") this._pattern("editable");
    }
    if ("readPretty" in state) {
      if (state.readPretty) this._pattern("readPretty");
      else if (this._pattern() === "readPretty") this._pattern("editable");
    }
    if ("editable" in state) {
      this._pattern(state.editable ? "editable" : "readOnly");
    }
    if ("required" in state) this._required(state.required!);
    if ("title" in state) this._title(state.title!);
    if ("description" in state) this._description(state.description!);
    if ("componentProps" in state) this._componentProps(state.componentProps!);
    if ("decoratorProps" in state) this._decoratorProps(state.decoratorProps!);
    if ("dataSource" in state) {
      this._dataSource(normalizeDataSource(state.dataSource));
      this._reconcileValueWithDataSource();
    }
    if ("loading" in state) this._loading(state.loading!);
    if ("component" in state && Array.isArray(state.component)) {
      this._component(state.component[0]);
      if (state.component[1] !== undefined) this._componentProps(state.component[1]);
    }
    if ("decorator" in state && Array.isArray(state.decorator)) {
      this._decorator(state.decorator[0]);
      if (state.decorator[1] !== undefined) this._decoratorProps(state.decorator[1]);
    }
    this._bumpVersion();
    endBatch();
    if (
      "value" in state ||
      "visible" in state ||
      "hidden" in state ||
      "display" in state
    ) {
      this._notifyValueChange();
    } else {
      this._notifyFieldChange();
    }
  }

  // ============================================================
  // Array field operations
  // ============================================================

  push(initialValues?: any): void {
    if (!this._arrayController?.push(initialValues)) return;
    this._bumpVersion();
    this._notifyValueChange();
  }

  remove(index: number): void {
    if (!this._arrayController?.remove(index)) return;
    this._bumpVersion();
    this._notifyValueChange();
  }

  /** Internal — rename this field's path/address. Used by array reindex. */
  _renamePath(newPath: string): void {
    (this as any).path = newPath;
    (this as any).address = newPath;
  }

  moveUp(index: number): void {
    if (!this._arrayController?.moveUp(index)) return;
    this._bumpVersion();
    this._notifyValueChange();
  }

  moveDown(index: number): void {
    if (!this._arrayController?.moveDown(index)) return;
    this._bumpVersion();
    this._notifyValueChange();
  }

  private _setArrayValue(value: any[]): void {
    if (!this._arrayController?.setValue(value)) return;
    this._bumpVersion();
    this._notifyValueChange();
  }

  // ============================================================
  // Validation
  // ============================================================

  async validate(): Promise<FieldError[]> {
    if (this._display() === "none") return [];

    this._form?._notifyFieldValidateStart?.(this.path, this);
    this._validateStatus("validating");
    const errors: FieldError[] = [];
    const val = this.value;

    // Required check
    if (this._required()) {
      if (isEmptyValue(val)) {
        errors.push({
          message: `${this._title() || this.path} is required`,
          type: "required",
        });
      }
    }

    // Run static validators
    for (const validator of this._validators) {
      const errs = await runValidator(validator, val, this);
      if (errs) errors.push(...errs);
    }

    if (this._xValidate && this._form?._runXValidate) {
      const dynamicErrors = await this._form._runXValidate(
        this,
        this._xValidate,
        val,
      );
      if (dynamicErrors.length > 0) errors.push(...dynamicErrors);
    }

    this._errors(errors);
    this._validateStatus(errors.length > 0 ? "error" : "success");
    this._bumpVersion();
    if (errors.length > 0) {
      this._form?._notifyFieldValidateFailed?.(this.path, this);
    } else {
      this._form?._notifyFieldValidateSuccess?.(this.path, this);
    }
    this._form?._notifyFieldValidateEnd?.(this.path, this);
    return errors;
  }

  reset(): void {
    startBatch();
    this._value(this._initialValue);
    this._errors([]);
    this._warnings([]);
    this._validateStatus("");
    if (this.isArrayField) {
      this._arrayController?.resetRows(this._initialValue);
    }
    this._bumpVersion();
    endBatch();
    this._notifyValueChange();
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    const dispose = effect(() => {
      this._version();
      listener();
    });
    return () => {
      this._listeners.delete(listener);
      dispose();
    };
  }

  // Internal — auto-subscribe effect that reads version
  _getVersion() {
    return this._version();
  }

  private _bumpVersion() {
    this._version(this._version() + 1);
  }

  private _notifyValueChange() {
    this._form?._notifyFieldValueChange?.(this.path, this);
  }

  private _notifyFieldChange() {
    this._form?._notifyFieldChange?.(this.path, this);
  }
}
