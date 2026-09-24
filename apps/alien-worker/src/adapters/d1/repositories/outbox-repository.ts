import type { AlienValue } from "@alien-form/protocol";
import type { OutboxRecord, OutboxRepository } from "@alien-form/alienbase";

interface OutboxRow {
  id: string;
  model: string;
  topic: string;
  payload: string;
  occurred_at: number;
  attempts: number;
}

/** D1 adapter for durable post-commit event delivery. */
export class D1OutboxRepository implements OutboxRepository {
  constructor(private readonly db: D1Database) {}

  async pending(limit: number): Promise<readonly OutboxRecord[]> {
    const { results } = await this.db
      .prepare(
        `SELECT "id", "model", "topic", "payload", "occurred_at", "attempts"
         FROM "_outbox"
         WHERE "processed_at" IS NULL
         ORDER BY "occurred_at", "id"
         LIMIT ?`,
      )
      .bind(limit)
      .all<OutboxRow>();
    return results.map((row) => ({
      id: row.id,
      model: row.model,
      topic: row.topic,
      payload: JSON.parse(row.payload) as AlienValue,
      occurredAt: row.occurred_at,
      attempts: row.attempts,
    }));
  }

  async markProcessed(id: string, processedAt: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE "_outbox"
         SET "processed_at" = ?, "last_error" = NULL
         WHERE "id" = ?`,
      )
      .bind(processedAt, id)
      .run();
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE "_outbox"
         SET "attempts" = "attempts" + 1, "last_error" = ?
         WHERE "id" = ?`,
      )
      .bind(reason.slice(0, 2000), id)
      .run();
  }
}
