/**
 * @alien-form/core — Field validation runtime.
 *
 * Re-exports schema validation utilities used by engine internals.
 * The validation pipeline is now:
 *   1. validate (static constraints from SchemaValidate)
 *   2. x-validate (dynamic rules via SchemaXRule)
 */

export {
  isEmptyValue,
  normalizeDataSource,
  normalizeValidationErrors,
  runStaticValidate,
} from "../../schema/validation";
