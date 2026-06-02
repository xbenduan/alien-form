import {
  schemas,
  summaries,
  schemaLoading,
  tableColumns,
  filterFields,
  detailItems,
  addFormSchema,
  editFormSchema,
  pagination,
} from '../internal/signals';
import { getSchemaProvider } from '../internal/provider';
import { projectTableColumns } from '../projection/table-columns';
import { projectFilterFields } from '../projection/filter-fields';
import { projectDetailItems } from '../projection/detail-items';
import { projectFormSchema } from '../projection/form-schema';

/**
 * Load all model summaries.
 */
export async function loadSchemas() {
  const provider = getSchemaProvider();
  schemaLoading.set(true);
  try {
    const result = await provider.list();
    const map: Record<string, any> = {};
    for (const item of result.list) {
      map[item.name] = item;
    }
    schemas.set(map);
    summaries.set(result.list);
  } finally {
    schemaLoading.set(false);
  }
}

/**
 * Load a single model schema and compute projections.
 */
export async function loadSchema(modelName: string) {
  const provider = getSchemaProvider();
  schemaLoading.set(true);
  try {
    const schema = await provider.detail(modelName);
    schemas.set({ ...schemas.get(), [modelName]: schema });

    // Auto-compute projections
    tableColumns.set(projectTableColumns(schema));
    filterFields.set(projectFilterFields(schema));
    detailItems.set(projectDetailItems(schema));
    addFormSchema.set(projectFormSchema(schema, 'add'));
    editFormSchema.set(projectFormSchema(schema, 'edit'));

    // Reset pagination page size from schema
    const defaultPageSize = schema?.['x-model']?.defaultPageSize ?? 10;
    pagination.set({ current: 1, pageSize: defaultPageSize });

    return schema;
  } finally {
    schemaLoading.set(false);
  }
}

/**
 * Get cached schema(s). No network call.
 */
export function getSchema(modelName?: string) {
  if (modelName) return schemas.get()[modelName];
  return summaries.get();
}

/**
 * Create a new model schema.
 */
export async function createSchema(schema: any) {
  const provider = getSchemaProvider();
  const result = await provider.create(schema);
  if (result.success) await loadSchemas();
  return result;
}

/**
 * Update an existing model schema.
 */
export async function updateSchema(modelName: string, schema: any) {
  const provider = getSchemaProvider();
  const result = await provider.update(modelName, schema);
  if (result.success) await loadSchemas();
  return result;
}

/**
 * Delete a model schema.
 */
export async function deleteSchema(modelName: string) {
  const provider = getSchemaProvider();
  const result = await provider.delete(modelName);
  if (result.success) await loadSchemas();
  return result;
}
