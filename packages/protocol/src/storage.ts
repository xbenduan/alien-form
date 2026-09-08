import type { DatabaseColumnType, DatabaseRelation, DatabaseValueType } from "./model-schema.ts";

export interface StorageColumn {
  fieldId: string;
  field: string;
  column: string;
  type: DatabaseColumnType;
  valueType?: DatabaseValueType;
  nullable: boolean;
  default?: string | number | boolean | null;
  unique: boolean;
  index: boolean;
  system: boolean;
}

export interface StorageIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

export interface StorageRelation {
  field: string;
  table: string;
  relation: DatabaseRelation;
}

export interface StorageManifest {
  model: string;
  table: string;
  version: number;
  columns: StorageColumn[];
  indexes: StorageIndex[];
  relations: StorageRelation[];
}

export type MigrationOperation =
  | { kind: "create-table"; sql: string }
  | { kind: "add-column"; sql: string }
  | { kind: "add-index"; sql: string }
  | { kind: "add-unique-index"; sql: string }
  | { kind: "add-relation-table"; sql: string };

export interface MigrationPlan {
  model: string;
  fromVersion: number;
  toVersion: number;
  operations: MigrationOperation[];
}
