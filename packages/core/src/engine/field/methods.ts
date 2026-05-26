import { effect, endBatch, startBatch } from "alien-signals";
import type {
  FieldDisplayTypes,
  FieldError,
  FieldMutableState,
  FieldPatternTypes,
  IField,
} from "../../schema/types";
import { arrayShallowEqual } from "../../utils";
import type { FieldInternals } from "./internals";
import { isEmptyValue, normalizeDataSource, runValidator } from "./validation";

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
      const nextProps = props ?? internals.signals.componentProps();
      if (
        internals.signals.component() === component &&
        shallowEqualObject(internals.signals.componentProps(), nextProps)
      ) {
        return;
      }
      startBatch();
      try {
        internals.signals.component(component);
        if (props !== undefined) internals.signals.componentProps(props);
        bumpFieldVersion(internals);
      } finally {
        endBatch();
      }
      notifyFieldChange(field, internals);
    },
    setDecorator(decorator, props) {
      const nextProps = props ?? internals.signals.decoratorProps();
      if (
        internals.signals.decorator() === decorator &&
        shallowEqualObject(internals.signals.decoratorProps(), nextProps)
      ) {
        return;
      }
      startBatch();
      try {
        internals.signals.decorator(decorator);
        if (props !== undefined) internals.signals.decoratorProps(props);
        bumpFieldVersion(internals);
      } finally {
        endBatch();
      }
      notifyFieldChange(field, internals);
    },
    setState(state) {
      const hasValueLikeChange =
        "value" in state || "visible" in state || "hidden" in state || "display" in state;
      let changed = false;

      startBatch();
      try {
        if ("value" in state) {
          if (internals.isArrayField && Array.isArray(state.value)) {
            changed = !!internals.arrayController?.setValue(state.value);
          } else if (!Object.is(internals.signals.value(), state.value)) {
            internals.signals.value(state.value);
            changed = true;
          }
        }
        if ("visible" in state) {
          const nextDisplay = state.visible ? "visible" : "none";
          if (internals.signals.display() !== nextDisplay) {
            internals.signals.display(nextDisplay);
            changed = true;
          }
        }
        if ("hidden" in state) {
          if (state.hidden) {
            if (internals.signals.display() !== "hidden") {
              internals.signals.display("hidden");
              changed = true;
            }
          } else if (internals.signals.display() === "hidden") {
            internals.signals.display("visible");
            changed = true;
          }
        }
        if ("display" in state && internals.signals.display() !== state.display) {
          internals.signals.display(state.display!);
          changed = true;
        }
        if ("pattern" in state && internals.signals.pattern() !== state.pattern) {
          internals.signals.pattern(state.pattern!);
          changed = true;
        }
        if ("disabled" in state) {
          if (state.disabled) {
            if (internals.signals.pattern() !== "disabled") {
              internals.signals.pattern("disabled");
              changed = true;
            }
          } else if (internals.signals.pattern() === "disabled") {
            internals.signals.pattern("editable");
            changed = true;
          }
        }
        if ("readOnly" in state) {
          if (state.readOnly) {
            if (internals.signals.pattern() !== "readOnly") {
              internals.signals.pattern("readOnly");
              changed = true;
            }
          } else if (internals.signals.pattern() === "readOnly") {
            internals.signals.pattern("editable");
            changed = true;
          }
        }
        if ("readPretty" in state) {
          if (state.readPretty) {
            if (internals.signals.pattern() !== "readPretty") {
              internals.signals.pattern("readPretty");
              changed = true;
            }
          } else if (internals.signals.pattern() === "readPretty") {
            internals.signals.pattern("editable");
            changed = true;
          }
        }
        if ("editable" in state) {
          const nextPattern = state.editable ? "editable" : "readOnly";
          if (internals.signals.pattern() !== nextPattern) {
            internals.signals.pattern(nextPattern);
            changed = true;
          }
        }
        if ("required" in state && internals.signals.required() !== state.required) {
          internals.signals.required(state.required!);
          changed = true;
        }
        if ("title" in state && internals.signals.title() !== state.title) {
          internals.signals.title(state.title!);
          changed = true;
        }
        if ("description" in state && internals.signals.description() !== state.description) {
          internals.signals.description(state.description!);
          changed = true;
        }
        if (
          "componentProps" in state &&
          !shallowEqualObject(internals.signals.componentProps(), state.componentProps!)
        ) {
          internals.signals.componentProps(state.componentProps!);
          changed = true;
        }
        if (
          "decoratorProps" in state &&
          !shallowEqualObject(internals.signals.decoratorProps(), state.decoratorProps!)
        ) {
          internals.signals.decoratorProps(state.decoratorProps!);
          changed = true;
        }
        if ("dataSource" in state) {
          const nextDataSource = normalizeDataSource(state.dataSource);
          if (!arrayShallowEqual(internals.signals.dataSource(), nextDataSource)) {
            internals.signals.dataSource(nextDataSource);
            changed = true;
          }
          changed = reconcileValueWithDataSource(field, internals) || changed;
        }
        if ("loading" in state && internals.signals.loading() !== state.loading) {
          internals.signals.loading(state.loading!);
          changed = true;
        }
        if ("component" in state && Array.isArray(state.component)) {
          if (internals.signals.component() !== state.component[0]) {
            internals.signals.component(state.component[0]);
            changed = true;
          }
          if (
            state.component[1] !== undefined &&
            !shallowEqualObject(internals.signals.componentProps(), state.component[1])
          ) {
            internals.signals.componentProps(state.component[1]);
            changed = true;
          }
        }
        if ("decorator" in state && Array.isArray(state.decorator)) {
          if (internals.signals.decorator() !== state.decorator[0]) {
            internals.signals.decorator(state.decorator[0]);
            changed = true;
          }
          if (
            state.decorator[1] !== undefined &&
            !shallowEqualObject(internals.signals.decoratorProps(), state.decorator[1])
          ) {
            internals.signals.decoratorProps(state.decorator[1]);
            changed = true;
          }
        }
        if (changed) bumpFieldVersion(internals);
      } finally {
        endBatch();
      }

      if (!changed) return;
      if (hasValueLikeChange) {
        notifyFieldValueChange(field, internals);
        return;
      }
      notifyFieldChange(field, internals);
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

      if (internals.signals.required() && isEmptyValue(value)) {
        errors.push({
          message: `${internals.signals.title() || internals.path} is required`,
          type: "required",
        });
      }

      for (const validator of internals.validators) {
        const validationErrors = await runValidator(validator, value, field);
        if (validationErrors) errors.push(...validationErrors);
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
