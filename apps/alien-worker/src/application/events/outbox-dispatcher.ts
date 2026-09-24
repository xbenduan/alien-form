import type { CompiledModelProvider, OutboxRepository } from "@alien-form/alienbase";

/** Dispatches committed events to model-owned consumers with retry bookkeeping. */
export class OutboxDispatcher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly models: CompiledModelProvider,
  ) {}

  async dispatchPending(limit = 50): Promise<void> {
    const events = await this.outbox.pending(limit);
    for (const event of events) {
      try {
        const model = await this.models.get(event.model);
        const handler = model?.eventHandlers[event.topic];
        if (handler) {
          await handler(event.payload, {
            eventId: event.id,
            model: event.model,
            occurredAt: event.occurredAt,
          });
        }
        await this.outbox.markProcessed(event.id, Date.now());
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        await this.outbox.markFailed(event.id, message);
        console.error(
          JSON.stringify({
            message: "outbox event dispatch failed",
            eventId: event.id,
            model: event.model,
            topic: event.topic,
            error: message,
          }),
        );
      }
    }
  }
}
