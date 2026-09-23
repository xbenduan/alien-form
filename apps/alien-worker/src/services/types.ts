import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";

export type ModelWriteOperation = "create" | "update" | "delete";
export type ModelReadOperation = "list" | "get" | "create" | "update" | "subtree";

interface ModelDataContext {
  models: Pick<ModelStore, "get">;
  records: Pick<RecordStore, "get" | "findByField" | "subtree">;
}

export interface ModelPrepareContext {
  actorId: string;
  operation: "create" | "update";
  previous?: Readonly<ModelRecord>;
}

export type ModelPrepareMiddleware = (
  values: Readonly<Record<string, unknown>>,
  context: ModelPrepareContext,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

export interface ModelValidationContext extends ModelDataContext {
  model: AlienSchema;
  actorId: string;
  operation: "create" | "update";
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
}

export type ModelValidateMiddleware = (context: ModelValidationContext) => void | Promise<void>;

export interface ModelPersistContext extends ModelDataContext {
  model: AlienSchema;
  actorId: string;
  operation: ModelWriteOperation;
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
}

export type ModelPersistMiddleware = (context: ModelPersistContext) => void | Promise<void>;

export interface ModelPresentContext {
  model: AlienSchema;
  actorId: string;
  operation: ModelReadOperation;
}

export type ModelPresentMiddleware = (
  record: Readonly<ModelRecord>,
  context: ModelPresentContext,
) => ModelRecord | Promise<ModelRecord>;
