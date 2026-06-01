/**
 * Common types shared across schema and record operations.
 */

// ─── Pagination ──────────────────────────────────────────────
export interface Pagination {
  current: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
}

// ─── Sorting ─────────────────────────────────────────────────
export interface Sorter {
  field: string;
  order: "ascend" | "descend";
}

// ─── Filtering ───────────────────────────────────────────────
export type FilterOperator = "eq" | "contains" | "gt" | "gte" | "lt" | "lte" | "in" | "between";

export interface FilterItem {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

// ─── Mutation Result ─────────────────────────────────────────
export interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
