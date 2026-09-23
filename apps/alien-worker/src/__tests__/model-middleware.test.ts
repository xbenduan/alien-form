import { describe, expect, it, vi } from "vitest";
import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import type { AuthorizationService } from "../services/global/authorization.ts";
import { RecordService } from "../services/global/record.ts";
import { ModelModules } from "../services/model-modules.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { RefExpander } from "../store/ref-expander.ts";

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

function dependencies(modules: ModelModules, events: string[]) {
  const models = { get: vi.fn().mockResolvedValue(schema) } as unknown as ModelStore;
  const records = {
    allocateId: vi.fn().mockResolvedValue("record"),
    create: vi.fn(async (_schema, value: ModelRecord) => {
      events.push("persist");
      return value;
    }),
  } as unknown as RecordStore;
  const refs = {
    expandOne: vi.fn(async (_schema, record) => record),
  } as unknown as RefExpander;
  const authorization = {
    profile: vi.fn().mockResolvedValue({ actorId: "actor" }),
    assertCan: vi.fn(() => events.push("authorizeAction")),
    assertFields: vi.fn(() => events.push("authorizeFields")),
    project: vi.fn((_profile, _schema, record: ModelRecord) => {
      const { secret: _secret, ...visible } = record;
      return visible;
    }),
  } as unknown as AuthorizationService;
  return new RecordService(models, records, refs, modules, authorization);
}

describe("model middleware pipeline", () => {
  it("runs the fixed create phases in order", async () => {
    const events: string[] = [];
    const modules = ModelModules.from([
      {
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
          afterCommit() {
            events.push("afterCommit");
          },
          present(record) {
            events.push("present");
            return { ...record, presented: true };
          },
        },
      },
    ]);

    const result = await dependencies(modules, events).create(
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
      "afterCommit",
      "present",
    ]);
    expect(result).toEqual({ id: "record", title: "标题", presented: true });
  });

  it("passes only the authorized representation to present", async () => {
    let presented: Readonly<ModelRecord> | undefined;
    const modules = ModelModules.from([
      {
        schema,
        middleware: {
          present(record) {
            presented = record;
            return { ...record };
          },
        },
      },
    ]);

    await dependencies(modules, []).create("article", { title: "标题", secret: "hidden" }, "actor");

    expect(presented).toEqual({ id: "record", title: "标题" });
  });
});
