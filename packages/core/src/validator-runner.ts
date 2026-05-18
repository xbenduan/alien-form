/**
 * @formily-bao/core — Static validator runner & x-validate result normalizer
 *
 * Used by Form.validate (delegated through Field) for both the schema-derived
 * rules (min/max/length/pattern/...) and the post-processing of x-validate
 * outputs into FieldError[].
 */

import type { FieldError, ValidatorRule } from './types'

export function isEmptyValue(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function normalizeDataSource(
  ds?: Array<any> | null
): Array<{ label: string; value: any; [key: string]: any }> {
  if (!ds || !Array.isArray(ds)) return []
  return ds.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item }
    }
    if (item && 'key' in item && 'title' in item && !('label' in item)) {
      return { label: String(item.title), value: item.key, ...item }
    }
    return item as { label: string; value: any; [key: string]: any }
  })
}

export function isValidatorRule(rule: ValidatorRule): boolean {
  return (
    !!rule &&
    ('required' in rule ||
      'min' in rule ||
      'max' in rule ||
      'minLength' in rule ||
      'maxLength' in rule ||
      'pattern' in rule ||
      'format' in rule ||
      'exclusiveMinimum' in rule ||
      'exclusiveMaximum' in rule ||
      'multipleOf' in rule ||
      'maxItems' in rule ||
      'minItems' in rule ||
      'uniqueItems' in rule ||
      'const' in rule)
  )
}

export function runValidatorRule(rule: ValidatorRule, value: any): FieldError[] {
  const errors: FieldError[] = []
  if (rule.required && isEmptyValue(value)) {
    errors.push({ message: rule.message || 'Field is required', type: 'required' })
  }
  if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
    errors.push({ message: rule.message || `Must be >= ${rule.min}`, type: 'min' })
  }
  if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
    errors.push({ message: rule.message || `Must be <= ${rule.max}`, type: 'max' })
  }
  if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
    errors.push({ message: rule.message || `Min length: ${rule.minLength}`, type: 'minLength' })
  }
  if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
    errors.push({ message: rule.message || `Max length: ${rule.maxLength}`, type: 'maxLength' })
  }
  if (rule.pattern) {
    const regex = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern
    if (value && !regex.test(String(value))) {
      errors.push({ message: rule.message || 'Invalid format', type: 'pattern' })
    }
  }
  if (rule.const !== undefined && value !== rule.const) {
    errors.push({
      message: rule.message || `Must equal ${JSON.stringify(rule.const)}`,
      type: 'const',
    })
  }
  return errors
}

/**
 * Normalize a free-form x-validate result (boolean | string | object | array)
 * into a flat FieldError list. Treats `undefined | null | true` as "passed",
 * and `false` as a generic "Invalid value" failure.
 */
export function normalizeValidationErrors(result: any): FieldError[] {
  if (result === undefined || result === null || result === true) return []
  if (result === false) return [{ message: 'Invalid value', type: 'x-validate' }]
  if (typeof result === 'string') return [{ message: result, type: 'x-validate' }]
  const values = Array.isArray(result) ? result : [result]
  const errors: FieldError[] = []
  for (const item of values) {
    if (item === undefined || item === null || item === true) continue
    if (item === false) {
      errors.push({ message: 'Invalid value', type: 'x-validate' })
      continue
    }
    if (typeof item === 'string') {
      errors.push({ message: item, type: 'x-validate' })
      continue
    }
    if (typeof item === 'object') {
      const rule = item as ValidatorRule
      const fieldError = item as FieldError
      if ('message' in fieldError && !isValidatorRule(rule)) {
        errors.push({ message: fieldError.message, type: fieldError.type || 'x-validate' })
        continue
      }
      const validatorErrors = runValidatorRule(rule, (item as any).value)
      if (validatorErrors.length > 0) errors.push(...validatorErrors)
      else if ('message' in fieldError)
        errors.push({ message: fieldError.message, type: fieldError.type || 'x-validate' })
    }
  }
  return errors
}
