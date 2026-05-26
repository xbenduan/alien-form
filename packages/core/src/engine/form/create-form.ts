import type { FormConfig, IForm } from "../../schema/types";
import { attachFormInternals, createFormInternals } from "./internals";
import { createFormMethods, trackDispose, type InternalForm } from "./methods";

export function createForm(config: FormConfig = {}): IForm {
  const form = {} as InternalForm;
  const internals = createFormInternals(form, config);
  const { publicMethods, runtimeMethods } = createFormMethods(form, internals);

  Object.assign(form, publicMethods);
  Object.defineProperties(form, {
    fields: { get: () => internals.fields, enumerable: true },
    values: {
      get: () => internals.valuesComputed!(),
      enumerable: true,
    },
    initialValues: { get: () => internals.initialValues, enumerable: true },
    valid: {
      get: () =>
        Array.from(internals.fields.values()).every((field) => !field.visible || field.errors.length === 0),
      enumerable: true,
    },
    invalid: {
      get: () =>
        !Array.from(internals.fields.values()).every((field) => !field.visible || field.errors.length === 0),
      enumerable: true,
    },
    submitting: { get: () => internals.submitting(), enumerable: true },
    errors: {
      get: () =>
        Array.from(internals.fields.values()).flatMap((field) => (field.visible ? field.errors : [])),
      enumerable: true,
    },
    _getInternals: { value: runtimeMethods._getInternals, enumerable: false },
    _emitError: { value: runtimeMethods._emitError, enumerable: false },
    _notifyFieldChange: { value: runtimeMethods._notifyFieldChange, enumerable: false },
    _notifyFieldValueChange: { value: runtimeMethods._notifyFieldValueChange, enumerable: false },
    _notifyFieldStructureChange: { value: runtimeMethods._notifyFieldStructureChange, enumerable: false },
    _notifyFieldValidateStart: { value: runtimeMethods._notifyFieldValidateStart, enumerable: false },
    _notifyFieldValidateEnd: { value: runtimeMethods._notifyFieldValidateEnd, enumerable: false },
    _notifyFieldValidateFailed: { value: runtimeMethods._notifyFieldValidateFailed, enumerable: false },
    _notifyFieldValidateSuccess: { value: runtimeMethods._notifyFieldValidateSuccess, enumerable: false },
    _createFieldTree: { value: runtimeMethods._createFieldTree, enumerable: false },
    _runXValidate: { value: runtimeMethods._runXValidate, enumerable: false },
    _rawValues: { value: runtimeMethods._rawValues, enumerable: false },
    _valuesSnapshot: { value: runtimeMethods._valuesSnapshot, enumerable: false },
  });

  attachFormInternals(form, internals);
  if (config.setup) {
    const dispose = config.setup(form);
    if (typeof dispose === "function") trackDispose(internals, dispose);
  }
  return form as IForm;
}
