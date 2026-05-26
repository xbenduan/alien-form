/**
 * @alien-form/core — Schema validation pure functions.
 *
 * Zero alien-signals dependency. All functions are pure and synchronous.
 */

import type {
  FieldError,
  IFieldSchema,
  Validator,
  ValidatorFormats,
  ValidatorRule,
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

export function normalizeValidators(v?: Validator | Validator[]): Validator[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

export function schemaValidators(schema: IFieldSchema): ValidatorRule[] {
  const rule: ValidatorRule = {};
  if (schema.minimum !== undefined) rule.min = schema.minimum;
  if (schema.maximum !== undefined) rule.max = schema.maximum;
  if (schema.exclusiveMinimum !== undefined) rule.exclusiveMinimum = schema.exclusiveMinimum;
  if (schema.exclusiveMaximum !== undefined) rule.exclusiveMaximum = schema.exclusiveMaximum;
  if (schema.multipleOf !== undefined) rule.multipleOf = schema.multipleOf;
  if (schema.minLength !== undefined) rule.minLength = schema.minLength;
  if (schema.maxLength !== undefined) rule.maxLength = schema.maxLength;
  if (schema.pattern !== undefined) rule.pattern = schema.pattern;
  if (schema.format !== undefined) rule.format = schema.format;
  if (schema.minItems !== undefined) rule.minItems = schema.minItems;
  if (schema.maxItems !== undefined) rule.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) rule.uniqueItems = schema.uniqueItems;
  if (schema.const !== undefined) rule.const = schema.const;
  return Object.keys(rule).length > 0 ? [rule] : [];
}

/**
 * Core synchronous rule application logic. Shared between async `runValidator`
 * and `normalizeValidationErrors` (which runs inline rules synchronously).
 */
export function applyValidatorRule(rule: ValidatorRule, value: any): FieldError[] {
  const errors: FieldError[] = [];

  if (rule.required && isEmptyValue(value)) {
    errors.push({ message: rule.message || "Field is required", type: "required" });
  }
  if (rule.min !== undefined && typeof value === "number" && value < rule.min) {
    errors.push({ message: rule.message || `Must be >= ${rule.min}`, type: "min" });
  }
  if (rule.max !== undefined && typeof value === "number" && value > rule.max) {
    errors.push({ message: rule.message || `Must be <= ${rule.max}`, type: "max" });
  }
  if (
    rule.exclusiveMinimum !== undefined &&
    typeof value === "number" &&
    value <= rule.exclusiveMinimum
  ) {
    errors.push({
      message: rule.message || `Must be > ${rule.exclusiveMinimum}`,
      type: "exclusiveMinimum",
    });
  }
  if (
    rule.exclusiveMaximum !== undefined &&
    typeof value === "number" &&
    value >= rule.exclusiveMaximum
  ) {
    errors.push({
      message: rule.message || `Must be < ${rule.exclusiveMaximum}`,
      type: "exclusiveMaximum",
    });
  }
  if (rule.multipleOf !== undefined && typeof value === "number" && value % rule.multipleOf !== 0) {
    errors.push({
      message: rule.message || `Must be a multiple of ${rule.multipleOf}`,
      type: "multipleOf",
    });
  }
  if (rule.minLength !== undefined && typeof value === "string" && value.length < rule.minLength) {
    errors.push({ message: rule.message || `Min length: ${rule.minLength}`, type: "minLength" });
  }
  if (rule.maxLength !== undefined && typeof value === "string" && value.length > rule.maxLength) {
    errors.push({ message: rule.message || `Max length: ${rule.maxLength}`, type: "maxLength" });
  }
  if (rule.minItems !== undefined && Array.isArray(value) && value.length < rule.minItems) {
    errors.push({ message: rule.message || `Minimum ${rule.minItems} items`, type: "minItems" });
  }
  if (rule.maxItems !== undefined && Array.isArray(value) && value.length > rule.maxItems) {
    errors.push({ message: rule.message || `Maximum ${rule.maxItems} items`, type: "maxItems" });
  }
  if (rule.uniqueItems && Array.isArray(value)) {
    const unique = new Set(value.map((item: any) => JSON.stringify(item)));
    if (unique.size !== value.length) {
      errors.push({ message: rule.message || "Items must be unique", type: "uniqueItems" });
    }
  }
  if (rule.const !== undefined && value !== rule.const) {
    errors.push({
      message: rule.message || `Must equal ${JSON.stringify(rule.const)}`,
      type: "const",
    });
  }
  if (rule.pattern) {
    const regex = typeof rule.pattern === "string" ? new RegExp(rule.pattern) : rule.pattern;
    if (value && !regex.test(String(value))) {
      errors.push({ message: rule.message || "Invalid format", type: "pattern" });
    }
  }
  if (rule.format && value) {
    const formatError = validateFormat(rule.format, value, rule.message);
    if (formatError) errors.push(formatError);
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
    if (typeof item === "object") {
      const fieldError = item as FieldError;
      if ("message" in fieldError && !isValidatorRule(item as ValidatorRule)) {
        errors.push({ message: fieldError.message, type: fieldError.type || "x-validate" });
        continue;
      }
      const validatorErrors = applyValidatorRule(item as ValidatorRule, (item as any).value);
      if (validatorErrors.length > 0) errors.push(...validatorErrors);
      else if ("message" in fieldError) {
        errors.push({ message: fieldError.message, type: fieldError.type || "x-validate" });
      }
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

function isValidatorRule(rule: ValidatorRule): boolean {
  return (
    !!rule &&
    ("required" in rule ||
      "min" in rule ||
      "max" in rule ||
      "minLength" in rule ||
      "maxLength" in rule ||
      "pattern" in rule ||
      "format" in rule ||
      "exclusiveMinimum" in rule ||
      "exclusiveMaximum" in rule ||
      "multipleOf" in rule ||
      "maxItems" in rule ||
      "minItems" in rule ||
      "uniqueItems" in rule ||
      "const" in rule ||
      "validator" in rule)
  );
}
