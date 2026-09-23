import type { Container } from "../../container.ts";

/** Creates a record with a stable ID only when it does not already exist. */
export async function ensureRecord(
  container: Container,
  model: string,
  id: string,
  values: Record<string, unknown>,
  actorId: string,
): Promise<void> {
  const schema = await container.modelStore.get(model);
  if (!schema) throw new Error(`内置模型未发布：${model}`);
  if (await container.recordStore.get(schema, id)) return;
  await container.recordService.create(model, { id, ...values }, actorId);
}
