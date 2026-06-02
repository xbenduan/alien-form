import { getSchemaProvider } from '../internal/provider';

/**
 * List all model summaries.
 */
export function listSchemas() {
  return getSchemaProvider().list();
}

/**
 * Get full schema for a model.
 */
export function getSchema(modelName: string) {
  return getSchemaProvider().detail(modelName);
}

/**
 * Create a new model schema.
 */
export function createSchema(schema: any) {
  return getSchemaProvider().create(schema);
}

/**
 * Update an existing model schema (full replace).
 */
export function updateSchema(modelName: string, schema: any) {
  return getSchemaProvider().update(modelName, schema);
}

/**
 * Delete a model schema.
 */
export function deleteSchema(modelName: string) {
  return getSchemaProvider().delete(modelName);
}
