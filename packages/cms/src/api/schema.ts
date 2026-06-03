import { getSchemaProvider } from '../internal/provider';
import type {
  CmsModelSchema,
  SchemaListParams,
} from "../types/schema";

/**
 * List all model summaries.
 */
export function listSchemas(params?: SchemaListParams) {
  return getSchemaProvider().list(params);
}

/**
 * Get full schema for a model.
 */
export function getSchema(modelName: string) {
  return getSchemaProvider().detail({ modelName });
}

/**
 * Create a new model schema.
 */
export function createSchema(schema: CmsModelSchema) {
  return getSchemaProvider().create({ schema });
}

/**
 * Update an existing model schema (full replace).
 */
export function updateSchema(modelName: string, schema: CmsModelSchema) {
  return getSchemaProvider().update({ modelName, schema });
}

/**
 * Delete a model schema.
 */
export function deleteSchema(modelName: string) {
  return getSchemaProvider().delete({ modelName });
}
