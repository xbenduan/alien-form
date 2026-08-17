export interface Pagination {
  current: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
}

export interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
