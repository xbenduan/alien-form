import { describe, expect, it, vi } from "vitest";
import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import type { AccessControl } from "@alien-form/alienbase";
import type {
  CompiledModelProvider,
  RecordExpander,
  RecordReader,
  UnitOfWork,
} from "@alien-form/alienbase";
import { RecordService } from "@alien-form/alienbase";
import type { ModelModule } from "@alien-form/alienbase";
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
    {
      id: "article.secret",
      key: "secret",
      type: "string",
      storage: { type: "text" },
      form: {},
    },
  ],
  form: { type: "object" },
  pages: [],
};

function dependencies(module: ModelModule, events: string[]) {
  const model = runtimeModel(schema, { lifecycle: module.middleware });
  let stored: ModelRecord | undefined;
  const models = {
    get: vi.fn().mockResolvedValue(model),
    require: vi.fn().mockResolvedValue(model),
  } as unknown as CompiledModelProvider;
  const records = {
    allocateId: vi.fn().mockResolvedValue("record"),
    get: vi.fn(async () => stored),
  } as unknown as RecordReader;
  const transactions = {
    commit: vi.fn(async (plan) => {
      events.push("persist");
      const mutation = plan.mutations[0];
      if (mutation?.operation !== "delete") stored = mutation.record;
    }),
  } as UnitOfWork;
  const refs = {
    expandOne: vi.fn(async (_schema, record) => record),
  } as unknown as RecordExpander;
  const access = {
    profile: vi.fn().mockResolvedValue({ actorId: "actor" }),
    assertCan: vi.fn(() => {
      events.push("authorizeAction");
      return "all";
    }),
    assertFields: vi.fn(() => events.push("authorizeFields")),
    project: vi.fn((_profile, _schema, record: ModelRecord) => {
      const { secret: _secret, ...visible } = record;
      return visible;
    }),
  } as unknown as AccessControl;
  return new RecordService(models, records, transactions, refs, access);
}

describe("model middleware pipeline", () => {
  it("runs the fixed create phases in order", async () => {
    const events: string[] = [];
    const module: ModelModule = {
      schema,
      middleware: {
        prepare(values) {
          events.push("prepare");
          expect(Object.isFrozen(values)).toBe(true);
          return { ...values, title: String(values.title).trim() };
        },
        validate({ record }) {
          events.push("validate");
          expect(Object.isFrozen(record)).toBe(true);
        },
        beforePersist({ record }) {
          events.push("beforePersist");
          expect(Object.isFrozen(record)).toBe(true);
        },
        present(record) {
          events.push("present");
          return { ...record, presented: true };
        },
      },
    };

    const result = await dependencies(module, events).create(
      "article",
      { title: "  标题  ", secret: "hidden" },
      "actor",
    );

    expect(events).toEqual([
      "authorizeAction",
      "authorizeFields",
      "prepare",
      "validate",
      "beforePersist",
      "persist",
      "present",
    ]);
    expect(result).toEqual({ id: "record", title: "标题", presented: true });
  });

  it("passes only the authorized representation to present", async () => {
    let presented: Readonly<ModelRecord> | undefined;
    const module: ModelModule = {
      schema,
      middleware: {
        present(record) {
          presented = record;
          return { ...record };
        },
      },
    };

    await dependencies(module, []).create("article", { title: "标题", secret: "hidden" }, "actor");

    expect(presented).toEqual({ id: "record", title: "标题" });
  });
});
