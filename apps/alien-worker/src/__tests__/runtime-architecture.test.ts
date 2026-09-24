import { describe, expect, it, vi } from "vitest";
import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import type { AccessControl } from "@alien-form/alienbase";
import type {
  CompiledModelProvider,
  ModelRepository,
  OutboxRepository,
  RecordExpander,
  RecordReader,
  TransactionPlan,
  UnitOfWork,
} from "@alien-form/alienbase";
import { RecordService, defineModel } from "@alien-form/alienbase";
import { CompiledModels } from "../application/compiled-models.ts";
import { OutboxDispatcher } from "../application/events/outbox-dispatcher.ts";
import { ModelModules } from "../application/model-modules.ts";
import { compileModel } from "../adapters/d1/compiler/model-compiler.ts";
import { D1RecordRepository } from "../adapters/d1/repositories/record-repository.ts";
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
    const models = new CompiledModels(repository, ModelModules.from([]), compileModel);

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

  it("compiles code models without reading persisted schemas", async () => {
    const repository = {
      get: vi.fn(),
    } as unknown as ModelRepository;
    const models = new CompiledModels(repository, ModelModules.from([{ schema }]), compileModel);

    await expect(models.require(schema.name)).resolves.toMatchObject({ schema });
    expect(repository.get).not.toHaveBeenCalled();
  });

  it("composes batch and exact behaviors in deterministic order", async () => {
    const calls: string[] = [];
    const cmsSchema = { ...schema, group: "cms" };
    const repository = {
      get: vi.fn().mockResolvedValue(cmsSchema),
    } as unknown as ModelRepository;
    const modules = ModelModules.from([
      defineModel({
        name: "article",
        middleware: {
          prepare(values) {
            calls.push(`exact:${String(values.title)}`);
            return { ...values, title: `${String(values.title)}-exact` };
          },
        },
        commands: {
          archive: {
            permission: "update",
            writeFields: [],
            async execute() {
              return { mutations: [] };
            },
          },
        },
        events: {
          changed() {
            calls.push("event:exact");
          },
        },
      }),
      defineModel({
        match: ({ schema }) => schema.group === "cms",
        middleware: {
          prepare(values) {
            calls.push(`batch:${String(values.title)}`);
            return { ...values, title: `${String(values.title)}-batch` };
          },
        },
        commands: {
          notify: {
            permission: "update",
            writeFields: [],
            async execute() {
              return { mutations: [] };
            },
          },
        },
        events: {
          changed() {
            calls.push("event:batch");
          },
        },
      }),
    ]);
    const models = new CompiledModels(repository, modules, compileModel);

    const model = await models.require("article");
    const prepared = await model.lifecycle?.prepare?.(
      { title: "draft" },
      { actorId: "actor", operation: "create" },
    );
    await model.eventHandlers.changed?.({}, { eventId: "event", model: "article", occurredAt: 1 });

    expect(prepared?.title).toBe("draft-batch-exact");
    expect(Object.keys(model.commands)).toEqual(["notify", "archive"]);
    expect(calls).toEqual(["batch:draft", "exact:draft-batch", "event:batch", "event:exact"]);
  });

  it("rejects duplicate commands while compiling matched behaviors", async () => {
    const command = {
      permission: "update" as const,
      writeFields: [],
      async execute() {
        return { mutations: [] };
      },
    };
    const repository = {
      get: vi.fn().mockResolvedValue({ ...schema, group: "cms" }),
    } as unknown as ModelRepository;
    const modules = ModelModules.from([
      defineModel({
        match: ({ schema }) => schema.group === "cms",
        commands: { publish: command },
      }),
      defineModel({ name: "article", commands: { publish: command } }),
    ]);

    await expect(
      new CompiledModels(repository, modules, compileModel).require("article"),
    ).rejects.toThrow("模型 article 的 Command 重复定义：publish");
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
    const store = new D1RecordRepository(db);

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
