import type { IField, IFieldSchema } from "../../schema/types";
import { attachFieldInternals, createFieldInternals, type FieldMeta } from "./internals";
import { createFieldMethods, getFieldValue } from "./methods";

export function createField(path: string, schema: IFieldSchema, initialValue?: any): IField {
  const field = {} as IField;
  const internals = createFieldInternals(path, schema, initialValue);
  const methods = createFieldMethods(field, internals);

  // Attach methods
  Object.assign(field, methods);

  // Define reactive getters
  Object.defineProperties(field, {
    path: { get: () => internals.path, enumerable: true },
    address: { get: () => internals.address, enumerable: true },
    value: { get: () => getFieldValue(field, internals), enumerable: true },
    initialValue: { get: () => internals.initialValue, enumerable: true },
    display: { get: () => internals.signals.display(), enumerable: true },
    visible: { get: () => internals.signals.display() !== "none", enumerable: true },
    hidden: { get: () => internals.signals.display() === "hidden", enumerable: true },
    disabled: { get: () => internals.signals.disabled(), enumerable: true },
    required: { get: () => internals.signals.required(), enumerable: true },
    errors: { get: () => internals.signals.errors(), enumerable: true },
    warnings: { get: () => internals.signals.warnings(), enumerable: true },
    validateStatus: { get: () => internals.signals.validateStatus(), enumerable: true },
    dataSource: { get: () => internals.signals.dataSource(), enumerable: true },
    loading: { get: () => internals.signals.loading(), enumerable: true },
    isArrayField: { get: () => internals.isArrayField, enumerable: true },
    arrayItems: { get: () => internals.arrayController?.getItems() || [], enumerable: true },

    // Meta fields (bundled into one signal for efficiency)
    title: { get: () => internals.signals.meta().title, enumerable: true },
    description: { get: () => internals.signals.meta().description, enumerable: true },
    component: { get: () => internals.signals.meta().component, enumerable: true },
    componentProps: { get: () => internals.signals.meta().componentProps, enumerable: true },
    decorator: { get: () => internals.signals.meta().decorator, enumerable: true },
    decoratorProps: { get: () => internals.signals.meta().decoratorProps, enumerable: true },
    data: { get: () => internals.signals.meta().data, enumerable: true },
    content: { get: () => internals.signals.meta().content, enumerable: true },
  });

  attachFieldInternals(field, internals);
  return field;
}
