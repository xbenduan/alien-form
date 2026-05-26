/**
 * @alien-form/core — Field validation runtime (async execution wrapper).
 *
 * Pure validation logic lives in schema/validation.ts. This file adds the
 * async runtime runner that requires IField.
 */

import type { FieldError, IField, Validator, ValidatorFn, ValidatorRule } from "../../schema/types";
import { applyValidatorRule } from "../../schema/validation";

// Re-export schema validation utilities used by engine internals
export {
  isEmptyValue,
  normalizeDataSource,
  normalizeValidators,
  schemaValidators,
  normalizeValidationErrors,
} from "../../schema/validation";

export async function runValidator(
  validator: Validator,
  value: any,
  field: IField,
): Promise<FieldError[] | null> {
  if (typeof validator === "function") {
    const msg = await (validator as ValidatorFn)(value, field);
    return msg ? [{ message: msg }] : null;
  }

  const rules = Array.isArray(validator) ? validator : [validator];
  const errors: FieldError[] = [];

  for (const rule of rules) {
    if ((rule as ValidatorRule).validator && field) {
      const msg = await (rule as ValidatorRule).validator!(value, field);
      if (msg) errors.push({ message: msg });
      continue;
    }
    errors.push(...applyValidatorRule(rule as ValidatorRule, value));
  }

  return errors.length > 0 ? errors : null;
}
