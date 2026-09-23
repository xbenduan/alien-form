import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import { AppError, badRequest } from "../../errors.ts";
import type { ModelStore } from "../../store/model-store.ts";
import type { RecordStore } from "../../store/record-store.ts";
import type { ModelModules } from "../model-modules.ts";
import type { ModelReadOperation, ModelWriteOperation } from "../types.ts";
import { immutable } from "./record-validation.ts";

function asInputError(reason: unknown): AppError {
  return reason instanceof AppError
    ? reason
    : badRequest(reason instanceof Error ? reason.message : String(reason));
}

export async function prepareModelInput(
  modules: ModelModules,
  modelCode: string,
  values: Record<string, unknown>,
  actorId: string,
  operation: "create" | "update",
  previous?: ModelRecord,
): Promise<Record<string, unknown>> {
  const prepare = (await modules.get(modelCode))?.middleware?.prepare;
  if (!prepare) return values;
  try {
    return await prepare(Object.freeze({ ...values }), {
      actorId,
      operation,
      previous: previous ? immutable(previous) : undefined,
    });
  } catch (reason) {
    throw asInputError(reason);
  }
}

export async function validateModelRecord(
  modules: ModelModules,
  models: ModelStore,
  records: RecordStore,
  schema: AlienSchema,
  record: ModelRecord,
  actorId: string,
  operation: "create" | "update",
  previous?: ModelRecord,
): Promise<void> {
  const validate = (await modules.get(schema.name))?.middleware?.validate;
  if (!validate) return;
  try {
    await validate({
      model: schema,
      models,
      records,
      actorId,
      operation,
      record: immutable(record),
      previous: previous ? immutable(previous) : undefined,
    });
  } catch (reason) {
    throw asInputError(reason);
  }
}

export async function runBeforePersist(
  modules: ModelModules,
  models: ModelStore,
  records: RecordStore,
  model: AlienSchema,
  actorId: string,
  operation: ModelWriteOperation,
  record: ModelRecord,
  previous?: ModelRecord,
): Promise<void> {
  const beforePersist = (await modules.get(model.name))?.middleware?.beforePersist;
  if (!beforePersist) return;
  try {
    await beforePersist({
      model,
      models,
      records,
      actorId,
      operation,
      record: immutable(record),
      previous: previous ? immutable(previous) : undefined,
    });
  } catch (reason) {
    throw asInputError(reason);
  }
}

export async function runAfterCommit(
  modules: ModelModules,
  models: ModelStore,
  records: RecordStore,
  model: AlienSchema,
  actorId: string,
  operation: ModelWriteOperation,
  record: ModelRecord,
  previous?: ModelRecord,
): Promise<void> {
  const afterCommit = (await modules.get(model.name))?.middleware?.afterCommit;
  if (!afterCommit) return;
  try {
    await afterCommit({
      model,
      models,
      records,
      actorId,
      operation,
      record: immutable(record),
      previous: previous ? immutable(previous) : undefined,
    });
  } catch (reason) {
    console.error(
      JSON.stringify({
        message: "model afterCommit middleware failed",
        model: model.name,
        operation,
        error: reason instanceof Error ? reason.message : String(reason),
      }),
    );
  }
}

export async function presentModelRecord(
  modules: ModelModules,
  model: AlienSchema,
  actorId: string,
  operation: ModelReadOperation,
  record: ModelRecord,
): Promise<ModelRecord> {
  const present = (await modules.get(model.name))?.middleware?.present;
  if (!present) return record;
  const output = await present(immutable(record), { model, actorId, operation });
  if (output.id !== record.id) {
    throw new Error(`模型 ${model.name} 的 present 中间件不能修改记录 ID`);
  }
  return output;
}
