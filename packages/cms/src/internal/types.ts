/**
 * Internal types — NOT exported to consumers.
 */

export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  source?: 'static' | 'runtime';
}

export interface ModelRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Pagination {
  current: number;
  pageSize: number;
}

export interface Sorter {
  field: string;
  order: 'ascend' | 'descend';
}

export interface MutationResult {
  success: boolean;
  message?: string;
}

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  ellipsis?: boolean;
  format?: string;
  dataSource?: Array<{ label: string; value: unknown }>;
  inline?: string[];
  expandable?: boolean;
  order: number;
}

export interface FilterField {
  key: string;
  title: string;
  component?: string;
  operator?: string;
  props?: Record<string, unknown>;
  dataSource?: Array<{ label: string; value: unknown }>;
  defaultVisible: boolean;
  order: number;
}

export interface DetailItem {
  key: string;
  title: string;
  format?: string;
  dataSource?: Array<{ label: string; value: unknown }>;
  order: number;
}

// ─── Provider Interfaces ──────────────────────────────────────

export interface SchemaProvider {
  list(): Promise<{ list: ModelSummary[] }>;
  detail(modelName: string): Promise<any>;
  create(schema: any): Promise<MutationResult>;
  update(modelName: string, schema: any): Promise<MutationResult>;
  delete(modelName: string): Promise<MutationResult>;
}

export interface RecordProvider {
  list(params: {
    model: string;
    filters?: Record<string, unknown>;
    pagination?: Pagination;
    sorter?: Sorter;
  }): Promise<{ list: ModelRecord[]; total: number }>;
  detail(model: string, id: string): Promise<ModelRecord>;
  create(model: string, values: Record<string, unknown>): Promise<MutationResult>;
  update(model: string, id: string, values: Record<string, unknown>): Promise<MutationResult>;
  delete(model: string, id: string): Promise<MutationResult>;
  batchDelete?(model: string, ids: string[]): Promise<MutationResult>;
}

export type ProviderFactory = (config: any) => {
  schema: SchemaProvider;
  record: RecordProvider;
};
