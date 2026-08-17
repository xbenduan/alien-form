import type {
  SchemaCreateParams,
  SchemaCreateResult,
  SchemaDeleteParams,
  SchemaDeleteResult,
  SchemaDetailParams,
  SchemaDetailResult,
  SchemaListParams,
  SchemaListResult,
  SchemaUpdateParams,
  SchemaUpdateResult,
} from "../types/schema";

/**
 * Interface for schema CRUD operations.
 * Implementations: LocalSchemaProvider (IndexedDB), RemoteSchemaProvider (HTTP).
 */
export interface SchemaProvider {
  /** List all model schemas (summaries). */
  list(params?: SchemaListParams): Promise<SchemaListResult>;

  /** Get full schema for a single model. */
  detail(params: SchemaDetailParams): Promise<SchemaDetailResult>;

  /** Create a new model schema. */
  create(params: SchemaCreateParams): Promise<SchemaCreateResult>;

  /** Update an existing model schema (full replacement). */
  update(params: SchemaUpdateParams): Promise<SchemaUpdateResult>;

  /** Delete a model schema. */
  delete(params: SchemaDeleteParams): Promise<SchemaDeleteResult>;

  /** Check if a model exists. */
  exists(modelName: string): Promise<boolean>;
}
