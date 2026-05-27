/**
 * @alien-form/core — Schema validation pure functions.
 *
 * Zero alien-signals dependency. All functions are pure and synchronous.
 */

import type {
  FieldError,
  IFieldSchema,
  SchemaValidate,
  ValidatorFormats,
} from "./types";

export function isEmptyValue(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function normalizeDataSource(
  ds?: Array<any> | null,
): Array<{ label: string; value: any; [key: string]: any }> {
  if (!ds || !Array.isArray(ds)) return [];
  return ds.map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return { label: String(item), value: item };
    }
    if (item && "key" in item && "title" in item && !("label" in item)) {
      return { label: String(item.title), value: item.key, ...item };
    }
    return item as { label: string; value: any; [key: string]: any };
  });
}

/**
 * Run the static `validate` constraints from a SchemaValidate object against a value.
 * Returns an array of FieldError (empty if all pass).
 */
export function runStaticValidate(validate: SchemaValidate | undefined, value: any): FieldError[] {
  if (!validate) return [];

  const errors: FieldError[] = [];
  const msg = validate.message;

  if (validate.required && isEmptyValue(value)) {
    errors.push({ message: msg || "Field is required", type: "required" });
  }

  // Array length constraints (check before empty-bail since empty arrays should fail minItems)
  if (validate.minItems !== undefined && Array.isArray(value) && value.length < validate.minItems) {
    errors.push({ message: msg || `Minimum ${validate.minItems} items`, type: "minItems" });
  }
  if (validate.maxItems !== undefined && Array.isArray(value) && value.length > validate.maxItems) {
    errors.push({ message: msg || `Maximum ${validate.maxItems} items`, type: "maxItems" });
  }

  // Skip further checks if value is empty (unless required already caught it)
  if (isEmptyValue(value)) return errors;

  // Numeric constraints
  if (validate.minimum !== undefined && typeof value === "number" && value < validate.minimum) {
    errors.push({ message: msg || `Must be >= ${validate.minimum}`, type: "minimum" });
  }
  if (validate.maximum !== undefined && typeof value === "number" && value > validate.maximum) {
    errors.push({ message: msg || `Must be <= ${validate.maximum}`, type: "maximum" });
  }
  if (
    validate.exclusiveMinimum !== undefined &&
    typeof value === "number" &&
    value <= validate.exclusiveMinimum
  ) {
    errors.push({
      message: msg || `Must be > ${validate.exclusiveMinimum}`,
      type: "exclusiveMinimum",
    });
  }
  if (
    validate.exclusiveMaximum !== undefined &&
    typeof value === "number" &&
    value >= validate.exclusiveMaximum
  ) {
    errors.push({
      message: msg || `Must be < ${validate.exclusiveMaximum}`,
      type: "exclusiveMaximum",
    });
  }
  if (validate.multipleOf !== undefined && typeof value === "number" && value % validate.multipleOf !== 0) {
    errors.push({
      message: msg || `Must be a multiple of ${validate.multipleOf}`,
      type: "multipleOf",
    });
  }

  // String constraints
  if (validate.minLength !== undefined && typeof value === "string" && value.length < validate.minLength) {
    errors.push({ message: msg || `Min length: ${validate.minLength}`, type: "minLength" });
  }
  if (validate.maxLength !== undefined && typeof value === "string" && value.length > validate.maxLength) {
    errors.push({ message: msg || `Max length: ${validate.maxLength}`, type: "maxLength" });
  }
  if (validate.pattern !== undefined) {
    const regex = new RegExp(validate.pattern);
    if (!regex.test(String(value))) {
      errors.push({ message: msg || "Invalid format", type: "pattern" });
    }
  }
  if (validate.format) {
    const formatError = validateFormat(validate.format, value, msg);
    if (formatError) errors.push(formatError);
  }

  // Array constraints (minItems/maxItems already checked above)
  if (validate.uniqueItems && Array.isArray(value)) {
    const unique = new Set(value.map((item: any) => JSON.stringify(item)));
    if (unique.size !== value.length) {
      errors.push({ message: msg || "Items must be unique", type: "uniqueItems" });
    }
  }

  // Const constraint
  if (validate.const !== undefined && value !== validate.const) {
    errors.push({
      message: msg || `Must equal ${JSON.stringify(validate.const)}`,
      type: "const",
    });
  }

  return errors;
}

/**
 * Normalize a free-form x-validate result (boolean | string | object | array)
 * into a flat FieldError list.
 */
export function normalizeValidationErrors(result: any): FieldError[] {
  if (result === undefined || result === null || result === true) return [];
  if (result === false) return [{ message: "Invalid value", type: "x-validate" }];
  if (typeof result === "string") return [{ message: result, type: "x-validate" }];

  const values = Array.isArray(result) ? result : [result];
  const errors: FieldError[] = [];

  for (const item of values) {
    if (item === undefined || item === null || item === true) continue;
    if (item === false) {
      errors.push({ message: "Invalid value", type: "x-validate" });
      continue;
    }
    if (typeof item === "string") {
      errors.push({ message: item, type: "x-validate" });
      continue;
    }
    if (typeof item === "object" && "message" in item) {
      errors.push({ message: (item as FieldError).message, type: (item as FieldError).type || "x-validate" });
    }
  }

  return errors;
}

export function validateFormat(format: string, value: any, message?: string): FieldError | null {
  const str = String(value);
  switch (format) {
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str))
        return { message: message || "Invalid email", type: "format" };
      break;
    case "url":
      if (!/^https?:\/\/.+/.test(str)) return { message: message || "Invalid URL", type: "format" };
      break;
    case "phone":
      if (!/^[\d\s\-+()]+$/.test(str))
        return { message: message || "Invalid phone number", type: "format" };
      break;
    case "number":
      if (isNaN(Number(str))) return { message: message || "Must be a number", type: "format" };
      break;
    case "integer":
      if (!/^-?\d+$/.test(str)) return { message: message || "Must be an integer", type: "format" };
      break;
    case "idcard":
      if (!/^(\d{15}|\d{17}[\dXx])$/.test(str))
        return { message: message || "Invalid ID card number", type: "format" };
      break;
    case "ip":
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(str))
        return { message: message || "Invalid IP address", type: "format" };
      break;
    case "ipv6":
      if (
        !/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(str) &&
        !/^(([0-9a-fA-F]{1,4}:)*):?(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?$/.test(str)
      ) {
        return { message: message || "Invalid IPv6 address", type: "format" };
      }
      break;
    case "zip":
      if (!/^\d{5,6}$/.test(str)) return { message: message || "Invalid zip code", type: "format" };
      break;
  }
  return null;
}
