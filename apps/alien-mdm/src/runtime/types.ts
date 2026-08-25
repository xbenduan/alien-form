import type {
  ModelFieldSchema,
  ModelGroup,
  ModelMeta,
  ModelSchema,
  OpenMode,
  TableFieldMeta,
} from "../compiler/shared";

export type { ModelFieldSchema, ModelGroup, ModelMeta, ModelSchema, OpenMode, TableFieldMeta };

export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: ModelGroup;
  fieldCount: number;
  updatedAt: string;
}

export interface ModelRecord {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface Pagination {
  current: number;
  pageSize: number;
}

export interface Sorter {
  field: string;
  order: "ascend" | "descend";
}

export interface RecordListParams {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

export interface RecordListResult {
  list: ModelRecord[];
  total: number;
}

export interface AuthUser extends ModelRecord {
  username?: string;
  displayName?: string;
  userType?: string;
  status?: string;
  roleIds?: string[];
}

export interface LoginPayload {
  provider?: "password" | string;
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  provider: string;
  user: AuthUser;
}
