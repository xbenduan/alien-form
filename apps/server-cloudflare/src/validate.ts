/**
 * Schema-based validation for CMS records.
 * Reads the schema definition from DB and validates values against field constraints.
 */

import type { Env } from "./types";

// ─── Types matching @alien-form/core schema structure ─────────────────────────

interface SchemaValidateRules {
  required?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  message?: string;
}

interface FieldSchema {
  type?: string;
  title?: string;
  required?: boolean;
  validate?: SchemaValidateRules;
  dataSource?: Array<{ label: string; value: any }>;
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema;
}

interface ModelSchema {
  type: "object";
  required?: boolean | string[];
  properties?: Record<string, FieldSchema>;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ─── Schema Loader ───────────────────────────────────────────────────────────

export async function loadSchema(db: D1Database, modelName: string): Promise<ModelSchema | null> {
  const row = await db.prepare(
    "SELECT schema_json FROM cms_schemas WHERE model_name = ?"
  ).bind(modelName).first<{ schema_json: string }>();

  if (!row) return null;

  try {
    return JSON.parse(row.schema_json) as ModelSchema;
  } catch {
    return null;
  }
}

// ─── Validators ──────────────────────────────────────────────────────────────

function getRequiredFields(schema: ModelSchema): Set<string> {
  const required = new Set<string>();

  // Collect from top-level `required` array (JSON Schema style)
  if (Array.isArray(schema.required)) {
    for (const name of schema.required) {
      required.add(name);
    }
  }

  // Collect from individual field `required` boolean (alien-form style)
  if (schema.properties) {
    for (const [name, field] of Object.entries(schema.properties)) {
      if (field.required === true) {
        required.add(name);
      }
      if (field.validate?.required === true) {
        required.add(name);
      }
    }
  }

  return required;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateFieldType(value: unknown, expectedType: string | undefined): string | null {
  if (value === null || value === undefined) return null; // handled by required check
  if (!expectedType) return null;

  switch (expectedType) {
    case "string":
      if (typeof value !== "string") return `expected string, got ${typeof value}`;
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) return `expected number, got ${typeof value}`;
      break;
    case "boolean":
      if (typeof value !== "boolean") return `expected boolean, got ${typeof value}`;
      break;
    case "array":
      if (!Array.isArray(value)) return `expected array, got ${typeof value}`;
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return `expected object, got ${typeof value}`;
      break;
  }
  return null;
}

function validateFieldRules(
  fieldName: string,
  value: unknown,
  field: FieldSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const rules = field.validate;
  const title = field.title ?? fieldName;

  if (!rules) return errors;

  // String rules
  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must be at least ${rules.minLength} characters` });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must not exceed ${rules.maxLength} characters` });
    }
    if (rules.pattern) {
      try {
        const re = new RegExp(rules.pattern);
        if (!re.test(value)) {
          errors.push({ field: fieldName, message: rules.message ?? `${title} does not match the required pattern` });
        }
      } catch {
        // Invalid regex in schema — skip
      }
    }
    if (rules.format) {
      const formatError = validateFormat(value, rules.format);
      if (formatError) {
        errors.push({ field: fieldName, message: rules.message ?? `${title} ${formatError}` });
      }
    }
  }

  // Number rules
  if (typeof value === "number") {
    if (rules.minimum !== undefined && value < rules.minimum) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must be >= ${rules.minimum}` });
    }
    if (rules.maximum !== undefined && value > rules.maximum) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must be <= ${rules.maximum}` });
    }
  }

  // Array rules
  if (Array.isArray(value)) {
    if (rules.minItems !== undefined && value.length < rules.minItems) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must have at least ${rules.minItems} items` });
    }
    if (rules.maxItems !== undefined && value.length > rules.maxItems) {
      errors.push({ field: fieldName, message: rules.message ?? `${title} must have at most ${rules.maxItems} items` });
    }
  }

  return errors;
}

function validateFormat(value: string, format: string): string | null {
  switch (format) {
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "is not a valid email";
      break;
    case "url":
      try { new URL(value); } catch { return "is not a valid URL"; }
      break;
    case "phone":
      if (!/^\+?[\d\s\-()]{7,20}$/.test(value)) return "is not a valid phone number";
      break;
    case "integer":
      if (!/^-?\d+$/.test(value)) return "is not a valid integer";
      break;
  }
  return null;
}

function validateDataSource(
  fieldName: string,
  value: unknown,
  field: FieldSchema,
): ValidationError | null {
  if (!field.dataSource || field.dataSource.length === 0) return null;
  if (value === null || value === undefined) return null;

  const allowedValues = field.dataSource.map((item) => item.value);

  if (Array.isArray(value)) {
    // Multi-select: all values must be in dataSource
    const invalid = value.filter((v) => !allowedValues.includes(v));
    if (invalid.length > 0) {
      return { field: fieldName, message: `${field.title ?? fieldName} contains invalid options: ${invalid.join(", ")}` };
    }
  } else {
    if (!allowedValues.includes(value)) {
      return { field: fieldName, message: `${field.title ?? fieldName} has an invalid value` };
    }
  }
  return null;
}

// ─── Main Validate Function ──────────────────────────────────────────────────

export interface ValidateOptions {
  /** If true, skip required checks for fields not present in values (useful for partial update) */
  partial?: boolean;
}

export function validateRecord(
  schema: ModelSchema,
  values: Record<string, unknown>,
  options: ValidateOptions = {},
): ValidationError[] {
  const errors: ValidationError[] = [];
  const properties = schema.properties ?? {};
  const requiredFields = getRequiredFields(schema);

  // 1. Required field checks
  if (!options.partial) {
    for (const name of requiredFields) {
      if (isEmpty(values[name])) {
        const field = properties[name];
        const title = field?.title ?? name;
        errors.push({ field: name, message: `${title} is required` });
      }
    }
  } else {
    // For partial updates, only check required on fields that are explicitly provided as empty
    for (const name of requiredFields) {
      if (name in values && isEmpty(values[name])) {
        const field = properties[name];
        const title = field?.title ?? name;
        errors.push({ field: name, message: `${title} is required` });
      }
    }
  }

  // 2. Type & rule checks for each provided value
  for (const [name, value] of Object.entries(values)) {
    const field = properties[name];
    if (!field) continue; // Allow extra fields silently (flexible schema)

    // Skip validation for empty optional fields
    if (isEmpty(value) && !requiredFields.has(name)) continue;
    if (isEmpty(value)) continue; // required error already captured above

    // Type check
    const typeError = validateFieldType(value, field.type);
    if (typeError) {
      errors.push({ field: name, message: `${field.title ?? name}: ${typeError}` });
      continue; // Skip further checks if type is wrong
    }

    // Rule-based validation
    errors.push(...validateFieldRules(name, value, field));

    // DataSource enum validation
    const dsError = validateDataSource(name, value, field);
    if (dsError) errors.push(dsError);
  }

  return errors;
}
