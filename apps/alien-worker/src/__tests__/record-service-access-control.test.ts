import { describe, expect, it, vi } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import type { AccessControl } from "../services/core/access-control.ts";
import type {
  CompiledModelProvider,
  RecordExpander,
  RecordReader,
  UnitOfWork,
} from "../services/core/contracts.ts";
import { RecordService } from "../services/core/record-service.ts";
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
      form: {},
    },
  ],
  form: {
    type: "object",
    properties: {
      id: { $ref: "#/fields/id" },
      title: { $ref: "#/fields/title" },
    },
  },
  pages: [],
};

/** Creates a record service with focused access-control doubles. */
function service(owner = "actor") {
  const model = runtimeModel(schema);
  let stored = { id: "record", title: "内容" };
  const models = {
    get: vi.fn().mockResolvedValue(model),
    require: vi.fn().mockResolvedValue(model),
  } as unknown as CompiledModelProvider;
  const records = {
    list: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    get: vi.fn().mockImplementation(async () => stored),
    owner: vi.fn().mockResolvedValue(owner),
    allocateId: vi.fn().mockResolvedValue("record"),
  } as unknown as RecordReader;
  const transactions = {
    commit: vi.fn(async (plan) => {
      const mutation = plan.mutations[0];
      if (mutation?.operation !== "delete") stored = mutation.record;
    }),
  } as UnitOfWork;
  const refs = {
    expand: vi.fn(async (_schema, records) => records),
    expandOne: vi.fn(async (_schema, record) => record),
  } as unknown as RecordExpander;
  const access = {
    profile: vi.fn().mockResolvedValue({ actorId: "actor" }),
    assertCan: vi.fn().mockReturnValue("own"),
    assertFields: vi.fn(),
    projectSchema: vi.fn().mockReturnValue(schema),
    project: vi.fn((_profile, _schema, record) => record),
  } as unknown as AccessControl;
  return {
    model,
    records,
    transactions,
    value: new RecordService(models, records, transactions, refs, access),
  };
}

describe("RecordService access control", () => {
  it("pushes own-scope filtering into list queries", async () => {
    const { model, records, value } = service();

    await value.list({ model: "article" }, "actor");

    expect(records.list).toHaveBeenCalledWith(model, expect.objectContaining({ ownerId: "actor" }));
  });

  it("rejects direct access to records owned by another actor", async () => {
    const { value } = service("other");

    await expect(value.get("article", "record", "actor")).rejects.toMatchObject({ status: 403 });
  });

  it("persists the authenticated actor as the record owner", async () => {
    const { transactions, value } = service();

    await value.create("article", { title: "内容" }, "actor");

    expect(transactions.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        mutations: [
          expect.objectContaining({
            operation: "create",
            model: expect.objectContaining({ key: "article@1" }),
            record: expect.objectContaining({ title: "内容" }),
            ownerId: "actor",
          }),
        ],
      }),
    );
  });
});
