import type { StoredModel } from "../contracts";
import type { RecordValue } from "formwork/model";

/** 将记录事件与业务数据放进同一个 batch，事件 payload 不包含私有字段。 */
export function outboxStatements(
  db: D1Database,
  model: StoredModel,
  operation: "create" | "update" | "delete",
  record: RecordValue,
): D1PreparedStatement[] {
  const privateKeys = new Set(
    model.definition.backend.storage.bindings
      .filter((binding) => model.definition.backend.permissions.privateFields.includes(binding.id))
      .map((binding) => binding.path.slice(1)),
  );
  const payload = Object.fromEntries(
    Object.entries(record).filter(([key]) => !privateKeys.has(key) && key !== "password"),
  );
  return (model.definition.backend.behavior.events[operation] ?? []).map((handler) =>
    db
      .prepare(
        `INSERT INTO fw_outbox(id, model_id, model_version, topic, handler, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        model.definition.document.id,
        model.version,
        operation,
        handler,
        JSON.stringify(payload),
        new Date().toISOString(),
      ),
  );
}
/** 派发已提交事件，并记录失败以允许下次请求重试。 */
export async function dispatchOutbox(db: D1Database): Promise<void> {
  const events = (
    await db
      .prepare(
        "SELECT id, model_id, topic, handler FROM fw_outbox WHERE delivered_at IS NULL ORDER BY created_at LIMIT 50",
      )
      .all<{ id: string; model_id: string; topic: string; handler: string }>()
  ).results;
  for (const event of events) {
    try {
      if (event.handler !== "audit.record") throw new Error(`未知 handler ${event.handler}`);
      // The audit handler emits only the stable event identity; it is safe to retry.
      console.info(
        JSON.stringify({ eventId: event.id, modelId: event.model_id, topic: event.topic }),
      );
      await db
        .prepare(
          "UPDATE fw_outbox SET delivered_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ? AND delivered_at IS NULL",
        )
        .bind(new Date().toISOString(), event.id)
        .run();
    } catch (error) {
      await db
        .prepare("UPDATE fw_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?")
        .bind(error instanceof Error ? error.message : String(error), event.id)
        .run();
    }
  }
}
