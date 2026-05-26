import { effect, endBatch, startBatch } from "alien-signals";
import type {
  FieldDisplayTypes,
  FieldError,
  FieldMutableState,
  FieldPatternTypes,
  IField,
} from "../../schema/types";
import { arrayShallowEqual } from "../../utils";
import type { FieldInternals, FieldMeta } from "./internals";
import { isEmptyValue, normalizeDataSource, runStaticValidate } from "./validation";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shallowEqualObject(
  left: Record<string, any> | undefined,
  right: Record<string, any> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

function bumpFieldVersion(internals: FieldInternals): void {
  internals.signals.version(internals.signals.version() + 1);
}

function notifyFieldChange(field: IField, internals: FieldInternals): void {
  internals.form?._notifyFieldChange?.(internals.path, field);
}

function notifyFieldValueChange(field: IField, internals: FieldInternals): void {
  internals.form?._notifyFieldValueChange?.(internals.path, field);
}

function readFieldValue(field: IField, internals: FieldInternals): any {
  return internals.isArrayField && internals.arrayController
    ? internals.arrayController.collectValue(internals.signals.value())
    : internals.signals.value();
}

/** Immutably update one or more keys on the meta signal. */
function updateMeta(internals: FieldInternals, patch: Partial<FieldMeta>): boolean {
  const current = internals.signals.meta();
  let changed = false;
  for (const key of Object.keys(patch) as (keyof FieldMeta)[]) {
    const newVal = patch[key];
    const curVal = current[key];
    if (typeof newVal === "object" && newVal !== null) {
      if (!shallowEqualObject(curVal as any, newVal as any)) { changed = true; break; }
    } else if (curVal !== newVal) {
      changed = true; break;
    }
  }
  if (!changed) return false;
  internals.signals.meta({ ...current, ...patch });
  return true;
}

function reconcileValueWithDataSource(field: IField, internals: FieldInternals): boolean {
  if (internals.reconcilingDataSourceValue) return false;

  const policy = internals.dataSourcePolicy || "preserve";
  if (policy === "preserve") return false;

  const currentDataSource = internals.signals.dataSource();
  if (currentDataSource.length === 0) return false;

  const validValues = new Set(currentDataSource.map((item) => item.value));
  const current = readFieldValue(field, internals);

  internals.reconcilingDataSourceValue = true;
  try {
    if (Array.isArray(current)) {
      if (policy === "filter" || policy === "clear") {
        const next = current.filter((item) => validValues.has(item));
        if (!arrayShallowEqual(next, current)) {
          internals.signals.value(next);
          return true;
        }
      }
      return false;
    }

    if (current === undefined || current === null || current === "") return false;
    if (validValues.has(current)) return false;

    if (policy === "clear" || policy === "filter") {
      internals.signals.value(undefined);
      return true;
    }
    if (policy === "first") {
      internals.signals.value(currentDataSource[0]?.value);
      return true;
    }
    return false;
  } finally {
    internals.reconcilingDataSourceValue = false;
  }
}

// ─── Display / Pattern shorthand resolution ──────────────────────────────────

/** Maps FieldMutableState shorthand keys to their canonical display value. */
function resolveDisplay(
  state: Partial<FieldMutableState>,
  current: FieldDisplayTypes,
): FieldDisplayTypes | undefined {
  if ("display" in state) return state.display!;
  if ("visible" in state) return state.visible ? "visible" : "none";
  if ("hidden" in state) {
    if (state.hidden) return "hidden";
    return current === "hidden" ? "visible" : undefined;
  }
  return undefined;
}

/** Maps FieldMutableState shorthand keys to their canonical pattern value. */
function resolvePattern(
  state: Partial<FieldMutableState>,
  current: FieldPatternTypes,
): FieldPatternTypes | undefined {
  if ("pattern" in state) return state.pattern!;
  if ("disabled" in state) {
    if (state.disabled) return "disabled";
    return current === "disabled" ? "editable" : undefined;
  }
  if ("readOnly" in state) {
    if (state.readOnly) return "readOnly";
    return current === "readOnly" ? "editable" : undefined;
  }
  if ("readPretty" in state) {
    if (state.readPretty) return "readPretty";
    return current === "readPretty" ? "editable" : undefined;
  }
  if ("editable" in state) return state.editable ? "editable" : "readOnly";
  return undefined;
}

// ─── Method bundle interface ─────────────────────────────────────────────────

export interface FieldMethodBundle {
  setValue(value: any): void;
  setErrors(errors: FieldError[]): void;
  setWarnings(warnings: FieldError[]): void;
  setDataSource(ds: Array<{ label: string; value: any; [key: string]: any }>): void;
  setLoading(loading: boolean): void;
  setDisplay(display: FieldDisplayTypes): void;
  setPattern(pattern: FieldPatternTypes): void;
  setComponent(component: string, props?: Record<string, any>): void;
  setDecorator(decorator: string, props?: Record<string, any>): void;
  setState(state: Partial<FieldMutableState>): void;
  push(initialValues?: any): void;
  remove(index: number): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
  validate(): Promise<FieldError[]>;
  reset(): void;
  subscribe(listener: () => void): () => void;
  effect(runner: (field: IField) => void): () => void;
  _renamePath(newPath: string): void;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createFieldMethods(field: IField, internals: FieldInternals): FieldMethodBundle {
  return {
    _renamePath(newPath) {
      internals.runtime.renamePath(newPath);
    },
    setValue(value) {
      if (internals.isArrayField && internals.form && internals.itemSchema) {
        if (!internals.arrayController?.setValue(Array.isArray(value) ? value : [])) return;
        bumpFieldVersion(internals);
        notifyFieldValueChange(field, internals);
        return;
      }

      if (Object.is(internals.signals.value(), value)) return;
      internals.signals.value(value);
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    setErrors(errors) {
      internals.signals.errors(errors);
      internals.signals.validateStatus(errors.length > 0 ? "error" : "success");
      bumpFieldVersion(internals);
    },
    setWarnings(warnings) {
      internals.signals.warnings(warnings);
      bumpFieldVersion(internals);
    },
    setDataSource(ds) {
      internals.signals.dataSource(normalizeDataSource(ds));
      const changedValue = reconcileValueWithDataSource(field, internals);
      bumpFieldVersion(internals);
      if (changedValue) notifyFieldValueChange(field, internals);
    },
    setLoading(loading) {
      if (internals.signals.loading() === loading) return;
      internals.signals.loading(loading);
      bumpFieldVersion(internals);
    },
    setDisplay(display) {
      if (internals.signals.display() === display) return;
      internals.signals.display(display);
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    setPattern(pattern) {
      if (internals.signals.pattern() === pattern) return;
      internals.signals.pattern(pattern);
      bumpFieldVersion(internals);
      notifyFieldChange(field, internals);
    },
    setComponent(component, props) {
      const meta = internals.signals.meta();
      const nextProps = props ?? meta.componentProps;
      if (meta.component === component && shallowEqualObject(meta.componentProps, nextProps)) return;
      updateMeta(internals, { component, ...(props !== undefined ? { componentProps: props } : {}) });
      bumpFieldVersion(internals);
      notifyFieldChange(field, internals);
    },
    setDecorator(decorator, props) {
      const meta = internals.signals.meta();
      const nextProps = props ?? meta.decoratorProps;
      if (meta.decorator === decorator && shallowEqualObject(meta.decoratorProps, nextProps)) return;
      updateMeta(internals, { decorator, ...(props !== undefined ? { decoratorProps: props } : {}) });
      bumpFieldVersion(internals);
      notifyFieldChange(field, internals);
    },

    setState(state) {
      let changed = false;
      const s = internals.signals;

      startBatch();
      try {
        // ── Value ──
        if ("value" in state) {
          if (internals.isArrayField && Array.isArray(state.value)) {
            changed = !!internals.arrayController?.setValue(state.value);
          } else if (!Object.is(s.value(), state.value)) {
            s.value(state.value);
            changed = true;
          }
        }

        // ── Display (visible/hidden/display all map to one signal) ──
        const nextDisplay = resolveDisplay(state, s.display());
        if (nextDisplay !== undefined && s.display() !== nextDisplay) {
          s.display(nextDisplay);
          changed = true;
        }

        // ── Pattern (disabled/readOnly/readPretty/editable/pattern all map to one signal) ──
        const nextPattern = resolvePattern(state, s.pattern());
        if (nextPattern !== undefined && s.pattern() !== nextPattern) {
          s.pattern(nextPattern);
          changed = true;
        }

        // ── Simple scalar signals ──
        if ("required" in state && s.required() !== state.required) {
          s.required(state.required!);
          changed = true;
        }
        if ("loading" in state && s.loading() !== state.loading) {
          s.loading(state.loading!);
          changed = true;
        }

        // ── Meta fields (title, description, componentProps, decoratorProps) ──
        const metaPatch: Partial<FieldMeta> = {};
        const meta = s.meta();
        if ("title" in state && meta.title !== state.title) metaPatch.title = state.title!;
        if ("description" in state && meta.description !== state.description) metaPatch.description = state.description!;
        if ("componentProps" in state && !shallowEqualObject(meta.componentProps, state.componentProps!)) {
          metaPatch.componentProps = state.componentProps!;
        }
        if ("decoratorProps" in state && !shallowEqualObject(meta.decoratorProps, state.decoratorProps!)) {
          metaPatch.decoratorProps = state.decoratorProps!;
        }
        if ("component" in state && Array.isArray(state.component)) {
          if (meta.component !== state.component[0]) metaPatch.component = state.component[0];
          if (state.component[1] !== undefined && !shallowEqualObject(meta.componentProps, state.component[1])) {
            metaPatch.componentProps = state.component[1];
          }
        }
        if ("decorator" in state && Array.isArray(state.decorator)) {
          if (meta.decorator !== state.decorator[0]) metaPatch.decorator = state.decorator[0];
          if (state.decorator[1] !== undefined && !shallowEqualObject(meta.decoratorProps, state.decorator[1])) {
            metaPatch.decoratorProps = state.decorator[1];
          }
        }
        if (Object.keys(metaPatch).length > 0) {
          updateMeta(internals, metaPatch);
          changed = true;
        }

        // ── DataSource ──
        if ("dataSource" in state) {
          const nextDS = normalizeDataSource(state.dataSource);
          if (!arrayShallowEqual(s.dataSource(), nextDS)) {
            s.dataSource(nextDS);
            changed = true;
          }
          changed = reconcileValueWithDataSource(field, internals) || changed;
        }

        if (changed) bumpFieldVersion(internals);
      } finally {
        endBatch();
      }

      if (!changed) return;

      // Determine notification type
      const hasValueLikeChange =
        "value" in state || "visible" in state || "hidden" in state || "display" in state;
      if (hasValueLikeChange) {
        notifyFieldValueChange(field, internals);
      } else {
        notifyFieldChange(field, internals);
      }
    },

    push(initialValues) {
      if (!internals.arrayController?.push(initialValues)) return;
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    remove(index) {
      if (!internals.arrayController?.remove(index)) return;
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    moveUp(index) {
      if (!internals.arrayController?.moveUp(index)) return;
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    moveDown(index) {
      if (!internals.arrayController?.moveDown(index)) return;
      bumpFieldVersion(internals);
      notifyFieldValueChange(field, internals);
    },
    async validate() {
      if (internals.signals.display() === "none") return [];

      internals.form?._notifyFieldValidateStart?.(internals.path, field);
      internals.signals.validateStatus("validating");
      const errors: FieldError[] = [];
      const value = readFieldValue(field, internals);

      // Step 1: Run static validate constraints (includes required check)
      const staticErrors = runStaticValidate(internals.validate, value);
      if (staticErrors.length > 0) errors.push(...staticErrors);

      // If no required error from validate, check top-level required signal
      if (internals.signals.required() && !internals.validate?.required && isEmptyValue(value)) {
        errors.push({
          message: `${internals.signals.meta().title || internals.path} is required`,
          type: "required",
        });
      }

      if (internals.xValidate && internals.form?._runXValidate) {
        const dynamicErrors = await internals.form._runXValidate(field, internals.xValidate, value);
        if (dynamicErrors.length > 0) errors.push(...dynamicErrors);
      }

      internals.signals.errors(errors);
      internals.signals.validateStatus(errors.length > 0 ? "error" : "success");
      bumpFieldVersion(internals);
      if (errors.length > 0) internals.form?._notifyFieldValidateFailed?.(internals.path, field);
      else internals.form?._notifyFieldValidateSuccess?.(internals.path, field);
      internals.form?._notifyFieldValidateEnd?.(internals.path, field);
      return errors;
    },
    reset() {
      startBatch();
      try {
        internals.signals.value(internals.initialValue);
        internals.signals.errors([]);
        internals.signals.warnings([]);
        internals.signals.validateStatus("");
        if (internals.isArrayField) internals.arrayController?.resetRows(internals.initialValue);
        bumpFieldVersion(internals);
      } finally {
        endBatch();
      }
      notifyFieldValueChange(field, internals);
    },
    subscribe(listener) {
      return effect(() => {
        internals.signals.version();
        listener();
      });
    },
    effect(runner) {
      return effect(() => {
        runner(field);
      });
    },
  };
}

export function getFieldValue(field: IField, internals: FieldInternals): any {
  return readFieldValue(field, internals);
}
