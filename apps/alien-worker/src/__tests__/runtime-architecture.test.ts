import { describe, expect, it, vi } from "vitest";
import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import type { AccessControl } from "../services/core/access-control.ts";
import type {
  CompiledModelProvider,
  ModelRepository,
  OutboxRepository,
  RecordExpander,
  RecordReader,
  TransactionPlan,
  UnitOfWork,
} from "../services/core/contracts.ts";
import { RecordService } from "../services/core/record-service.ts";
import { CompiledModels } from "../services/compiled-models.ts";
import { OutboxDispatcher } from "../services/events/outbox-dispatcher.ts";
import { ModelModules } from "../services/model-modules.ts";
import { RecordStore } from "../store/record-store.ts";
import { runtimeModel } from "./runtime-model.ts";

const schema: AlienSchema = {
  name: "article",
  title: "文章",
  version: 1,
  fields: [
    {
      id: "article.id",
      key: "id",
      type: "string",
      storage: { type: "text" },
      form: {},
    },
    {
      id: "article.title",
      key: "title",
      type: "string",
      storage: { type: "text" },
      form: {},
    },
  ],
  form: { type: "object" },
  pages: [],
};

describe("compiled model registry", () => {
  it("caches immutable plans by model version and rebuilds after invalidation", async () => {
    let current = schema;
    const repository = {
      get: vi.fn(async () => current),
    } as unknown as ModelRepository;
    const models = new CompiledModels(repository, ModelModules.from([{ schema }]));

    const first = await models.require(schema.name);
    const cached = await models.require(schema.name);
    expect(cached).toBe(first);
    expect(first.key).toBe("article@1");

    current = { ...schema, version: 2 };
    models.invalidate(schema.name);
    const next = await models.require(schema.name);
    expect(next).not.toBe(first);
    expect(next.key).toBe("article@2");
  });
});

describe("D1 unit of work", () => {
  it("submits record mutations and outbox inserts in one batch", async () => {
    const statements: Array<{ sql: string; args: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          sql,
          args: [] as unknown[],
          bind(...args: unknown[]) {
            this.args = args;
            return this;
          },
        };
        statements.push(statement);
        return statement;
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const model = runtimeModel(schema);
    const store = new RecordStore(db);

    await store.commit({
      mutations: [
        {
          operation: "create",
          model,
          record: { id: "record", title: "标题" },
          ownerId: "actor",
        },
      ],
      events: [
        {
          id: "event",
          model: schema.name,
          topic: "record.created",
          payload: { id: "record" },
          occurredAt: 1,
        },
      ],
    });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(statements.map(({ sql }) => sql)).toEqual([
      expect.stringContaining('INSERT INTO "article"'),
      expect.stringContaining('INSERT INTO "_outbox"'),
    ]);
  });
});

describe("model commands", () => {
  it("stages declared mutations and events through the common transaction pipeline", async () => {
    let stored: ModelRecord | undefined;
    let committed: TransactionPlan | undefined;
    const model = runtimeModel(schema, {
      commands: {
        publish: {
          permission: "update",
          writeFields: ["title"],
          async execute() {
            return {
              mutations: [{ operation: "create", values: { title: "已发布" } }],
              events: [{ topic: "article.published", payload: { source: "command" } }],
              output: { accepted: true },
            };
          },
        },
        unsafe: {
          permission: "update",
          writeFields: ["title"],
          async execute() {
            return {
              mutations: [{ operation: "create", values: { title: "标题", secret: "越权" } }],
            };
          },
        },
      },
    });
    const models = {
      get: vi.fn().mockResolvedValue(model),
      require: vi.fn().mockResolvedValue(model),
    } as unknown as CompiledModelProvider;
    const records = {
      allocateId: vi.fn().mockResolvedValue("record"),
      get: vi.fn(async () => stored),
    } as unknown as RecordReader;
    const transactions = {
      commit: vi.fn(async (plan: TransactionPlan) => {
        committed = plan;
        const mutation = plan.mutations[0];
        if (mutation?.operation !== "delete") stored = mutation.record;
      }),
    } satisfies UnitOfWork;
    const refs = {
      expandOne: vi.fn(async (_schema, record) => record),
    } as unknown as RecordExpander;
    const access = {
      profile: vi.fn().mockResolvedValue({ actorId: "actor" }),
      assertCan: vi.fn().mockReturnValue("all"),
      assertFields: vi.fn(),
      project: vi.fn((_profile, _schema, record) => record),
    } as unknown as AccessControl;
    const service = new RecordService(models, records, transactions, refs, access);

    const result = await service.executeCommand("article", "publish", {}, "actor");

    expect(result).toMatchObject({ output: { accepted: true }, records: [{ title: "已发布" }] });
    expect(committed?.mutations).toHaveLength(1);
    expect(committed?.events.map(({ topic }) => topic)).toEqual([
      "article.published",
      "record.created",
    ]);
    await expect(service.executeCommand("article", "unsafe", {}, "actor")).rejects.toThrow(
      "未声明写入字段：secret",
    );
    expect(transactions.commit).toHaveBeenCalledTimes(1);
  });
});

describe("outbox dispatcher", () => {
  it("marks successful events processed and failed events retryable", async () => {
    const handler = vi.fn(async (payload) => {
      if (payload === "fail") throw new Error("handler failed");
    });
    const model = runtimeModel(schema, { eventHandlers: { changed: handler } });
    const models = {
      get: vi.fn().mockResolvedValue(model),
    } as unknown as CompiledModelProvider;
    const outbox = {
      pending: vi.fn().mockResolvedValue([
        {
          id: "ok",
          model: "article",
          topic: "changed",
          payload: "ok",
          occurredAt: 1,
          attempts: 0,
        },
        {
          id: "failed",
          model: "article",
          topic: "changed",
          payload: "fail",
          occurredAt: 2,
          attempts: 0,
        },
      ]),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    } satisfies OutboxRepository;

    await new OutboxDispatcher(outbox, models).dispatchPending();

    expect(outbox.markProcessed).toHaveBeenCalledWith("ok", expect.any(Number));
    expect(outbox.markFailed).toHaveBeenCalledWith("failed", "handler failed");
  });
});
