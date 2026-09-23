import { describe, expect, it, vi } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import { ModelRegistry } from "../register/registry.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { AuthorizationService } from "./authorization-service.ts";
import { ModelService } from "./model-service.ts";

/** Creates a minimal valid model schema for service tests. */
function schema(name = "article"): AlienSchema {
  return {
    name,
    title: "文章",
    version: 0,
    group: "other",
    fields: [
      {
        id: `${name}.id`,
        key: "id",
        type: "string",
        title: "ID",
        required: true,
        storage: {
          type: "text",
          system: true,
          unique: true,
          index: true,
        },
        form: { display: "hidden" },
      },
      {
        id: `${name}.createdAt`,
        key: "createdAt",
        type: "string",
        title: "创建时间",
        required: true,
        storage: { type: "integer", system: true },
        form: {},
      },
      {
        id: `${name}.updatedAt`,
        key: "updatedAt",
        type: "string",
        title: "更新时间",
        required: true,
        storage: { type: "integer", system: true },
        form: {},
      },
    ],
    form: {
      type: "object",
      properties: {
        id: { $ref: "#/fields/id" },
        createdAt: { $ref: "#/fields/createdAt" },
        updatedAt: { $ref: "#/fields/updatedAt" },
      },
    },
    pages: [],
  };
}

/** Creates model service dependencies with permissive authorization. */
function dependencies() {
  const publish = vi.fn(async (value: AlienSchema) => value);
  const remove = vi.fn();
  const models = {
    get: vi.fn(async (name: string) => (name === "_sys_model_tab" ? schema(name) : undefined)),
    has: vi.fn().mockResolvedValue(false),
    list: vi.fn().mockResolvedValue([]),
    publish,
    delete: remove,
  } as unknown as ModelStore;
  const authorization = {
    profile: vi.fn().mockResolvedValue({
      actorId: "admin",
      permissions: new Map(),
      canCreateModel: true,
      super: false,
    }),
    assertCanCreateModel: vi.fn(),
    assertCan: vi.fn(),
    assertCanManageModel: vi.fn(),
    canRead: vi.fn().mockReturnValue(true),
  } as unknown as AuthorizationService;
  const records = {
    findByField: vi.fn().mockResolvedValue({ id: "tab-other", code: "other", aggregate: false }),
  } as unknown as RecordStore;
  return { authorization, models, publish, records, remove };
}

describe("ModelService", () => {
  it("rejects updates and deletes for registered system models", async () => {
    const { authorization, models, records, remove } = dependencies();
    const registry = new ModelRegistry();
    registry.model("_sys_test", { schema: schema("_sys_test") });
    const service = new ModelService(models, records, authorization, registry);

    await expect(service.update("_sys_test", schema("_sys_test"), "admin")).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.remove("_sys_test", "admin")).rejects.toMatchObject({ status: 403 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("records the authenticated creator instead of trusting submitted metadata", async () => {
    const { authorization, models, publish, records } = dependencies();
    const service = new ModelService(models, records, authorization, new ModelRegistry());

    await service.create({ ...schema(), creatorId: "spoofed", system: true }, "admin");

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "admin", system: false, version: 1 }),
      "article",
      expect.any(Object),
      0,
    );
  });

  it("runs storage migrations when a system schema revision adds physical fields", async () => {
    const desired = {
      ...schema("_sys_test"),
      system: true,
      systemRevision: 2,
      fields: schema("_sys_test").fields.map((field) =>
        field.key === "updatedAt" ? { ...field, required: false } : field,
      ),
    };
    const current = {
      ...desired,
      version: 1,
      systemRevision: 1,
      fields: desired.fields.filter((field) => field.key !== "updatedAt"),
    };
    const publish = vi.fn(async (value: AlienSchema) => value);
    const models = {
      get: vi.fn().mockResolvedValue(current),
      publish,
    } as unknown as ModelStore;
    const registry = new ModelRegistry();
    registry.model("_sys_test", { schema: desired });
    const service = new ModelService(
      models,
      {} as RecordStore,
      {} as AuthorizationService,
      registry,
    );

    await service.ensureSystemModel(desired);

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: "_sys_test", version: 2 }),
      "_sys_test",
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            kind: "add-column",
          }),
        ],
      }),
      1,
    );
  });
});
