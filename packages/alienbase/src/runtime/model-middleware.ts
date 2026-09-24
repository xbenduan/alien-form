import type { ModelRecord } from "@alien-form/protocol";
import { AppError, badRequest } from "../errors.ts";
import type {
  CompiledModel,
  CompiledModelProvider,
  EventCollector,
  ModelReadOperation,
  ModelWriteOperation,
  RecordReader,
} from "./contracts.ts";
import { immutable } from "./record-validation.ts";

function asInputError(reason: unknown): AppError {
  return reason instanceof AppError
    ? reason
    : badRequest(reason instanceof Error ? reason.message : String(reason));
}

export async function prepareModelInput(
  model: CompiledModel,
  values: Record<string, unknown>,
  actorId: string,
  operation: "create" | "update",
  previous?: ModelRecord,
): Promise<Record<string, unknown>> {
  const prepare = model.lifecycle?.prepare;
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
  models: CompiledModelProvider,
  records: RecordReader,
  model: CompiledModel,
  record: ModelRecord,
  actorId: string,
  operation: "create" | "update",
  previous?: ModelRecord,
): Promise<void> {
  const validate = model.lifecycle?.validate;
  if (!validate) return;
  try {
    await validate({
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

export async function runBeforePersist(
  models: CompiledModelProvider,
  records: RecordReader,
  model: CompiledModel,
  actorId: string,
  operation: ModelWriteOperation,
  record: ModelRecord,
  events: EventCollector,
  previous?: ModelRecord,
): Promise<void> {
  const beforePersist = model.lifecycle?.beforePersist;
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
      events,
    });
  } catch (reason) {
    throw asInputError(reason);
  }
}

export async function presentModelRecord(
  model: CompiledModel,
  actorId: string,
  operation: ModelReadOperation,
  record: ModelRecord,
): Promise<ModelRecord> {
  const present = model.lifecycle?.present;
  if (!present) return record;
  const output = await present(immutable(record), { model, actorId, operation });
  if (output.id !== record.id) {
    throw new Error(`模型 ${model.schema.name} 的 present 中间件不能修改记录 ID`);
  }
  return output;
}
