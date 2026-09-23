import { describe, expect, it, vi } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { RefExpander } from "../store/ref-expander.ts";
import type { AccessControl } from "../services/core/access-control.ts";
import { RecordService } from "../services/core/record-service.ts";
import { ModelModules } from "../services/model-modules.ts";

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
  const models = { get: vi.fn().mockResolvedValue(schema) } as unknown as ModelStore;
  const records = {
    list: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    get: vi.fn().mockResolvedValue({ id: "record", title: "内容" }),
    owner: vi.fn().mockResolvedValue(owner),
    allocateId: vi.fn().mockResolvedValue("record"),
    create: vi.fn().mockImplementation(async (_schema, value) => value),
  } as unknown as RecordStore;
  const refs = {
    expand: vi.fn(async (_schema, records) => records),
    expandOne: vi.fn(async (_schema, record) => record),
  } as unknown as RefExpander;
  const access = {
    profile: vi.fn().mockResolvedValue({ actorId: "actor" }),
    assertCan: vi.fn().mockReturnValue("own"),
    assertFields: vi.fn(),
    projectSchema: vi.fn().mockReturnValue(schema),
    project: vi.fn((_profile, _schema, record) => record),
  } as unknown as AccessControl;
  return {
    records,
    value: new RecordService(models, records, refs, ModelModules.from([]), access),
  };
}

describe("RecordService access control", () => {
  it("pushes own-scope filtering into list queries", async () => {
    const { records, value } = service();

    await value.list({ model: "article" }, "actor");

    expect(records.list).toHaveBeenCalledWith(
      schema,
      expect.objectContaining({ ownerId: "actor" }),
    );
  });

  it("rejects direct access to records owned by another actor", async () => {
    const { value } = service("other");

    await expect(value.get("article", "record", "actor")).rejects.toMatchObject({ status: 403 });
  });

  it("persists the authenticated actor as the record owner", async () => {
    const { records, value } = service();

    await value.create("article", { title: "内容" }, "actor");

    expect(records.create).toHaveBeenCalledWith(
      schema,
      expect.objectContaining({ title: "内容" }),
      "actor",
    );
  });
});
