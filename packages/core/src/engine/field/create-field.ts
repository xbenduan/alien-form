import type { IField, IFieldSchema } from "../../schema/types";
import { attachFieldInternals, createFieldInternals } from "./internals";
import { createFieldMethods, getFieldValue } from "./methods";

export function createField(path: string, schema: IFieldSchema, initialValue?: any): IField {
  const field = {} as IField;
  const internals = createFieldInternals(path, schema, initialValue);
  const methods = createFieldMethods(field, internals);

  Object.assign(field, {
    setValue: methods.setValue,
    setErrors: methods.setErrors,
    setWarnings: methods.setWarnings,
    setDataSource: methods.setDataSource,
    setLoading: methods.setLoading,
    setDisplay: methods.setDisplay,
    setPattern: methods.setPattern,
    setComponent: methods.setComponent,
    setDecorator: methods.setDecorator,
    setState: methods.setState,
    push: methods.push,
    remove: methods.remove,
    moveUp: methods.moveUp,
    moveDown: methods.moveDown,
    validate: methods.validate,
    reset: methods.reset,
    subscribe: methods.subscribe,
    effect: methods.effect,
  });
  Object.defineProperties(field, {
    path: { get: () => internals.path, enumerable: true },
    address: { get: () => internals.address, enumerable: true },
    value: { get: () => getFieldValue(field, internals), enumerable: true },
    initialValue: { get: () => internals.initialValue, enumerable: true },
    display: { get: () => internals.signals.display(), enumerable: true },
    visible: { get: () => internals.signals.display() !== "none", enumerable: true },
    hidden: { get: () => internals.signals.display() === "hidden", enumerable: true },
    pattern: { get: () => internals.signals.pattern(), enumerable: true },
    disabled: { get: () => internals.signals.pattern() === "disabled", enumerable: true },
    readOnly: { get: () => internals.signals.pattern() === "readOnly", enumerable: true },
    readPretty: { get: () => internals.signals.pattern() === "readPretty", enumerable: true },
    editable: { get: () => internals.signals.pattern() === "editable", enumerable: true },
    required: { get: () => internals.signals.required(), enumerable: true },
    errors: { get: () => internals.signals.errors(), enumerable: true },
    warnings: { get: () => internals.signals.warnings(), enumerable: true },
    validateStatus: { get: () => internals.signals.validateStatus(), enumerable: true },
    title: { get: () => internals.signals.title(), enumerable: true },
    description: { get: () => internals.signals.description(), enumerable: true },
    component: { get: () => internals.signals.component(), enumerable: true },
    componentProps: { get: () => internals.signals.componentProps(), enumerable: true },
    decorator: { get: () => internals.signals.decorator(), enumerable: true },
    decoratorProps: { get: () => internals.signals.decoratorProps(), enumerable: true },
    dataSource: { get: () => internals.signals.dataSource(), enumerable: true },
    loading: { get: () => internals.signals.loading(), enumerable: true },
    data: { get: () => internals.signals.data(), enumerable: true },
    content: { get: () => internals.signals.content(), enumerable: true },
    isArrayField: { get: () => internals.isArrayField, enumerable: true },
    arrayItems: { get: () => internals.arrayController?.getItems() || [], enumerable: true },
    _renamePath: { value: methods._renamePath, enumerable: false },
  });

  attachFieldInternals(field, internals);
  return field;
}
