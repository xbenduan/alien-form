import { describe, expect, it, vi } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import type { AccessControl } from "../services/core/access-control.ts";
import type { CompiledModelProvider, ModelRepository } from "../services/core/contracts.ts";
import { ModelService, type ModelGroupPolicy } from "../services/core/model-service.ts";

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

/** Creates model service dependencies with permissive access control. */
function dependencies() {
  const publish = vi.fn(async (_current: AlienSchema | undefined, value: AlienSchema) => value);
  const remove = vi.fn();
  const models = {
    get: vi.fn(),
    has: vi.fn().mockResolvedValue(false),
    list: vi.fn().mockResolvedValue([]),
    publish,
    delete: remove,
  } as unknown as ModelRepository;
  const access = {
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
  } as unknown as AccessControl;
  const groups = {
    assertValid: vi.fn(),
  } satisfies ModelGroupPolicy;
  return { access, groups, models, publish, remove };
}

function compiledModels(systemModels: string[] = []): CompiledModelProvider {
  return {
    get: vi.fn(),
    require: vi.fn(),
    invalidate: vi.fn(),
    isCodeModel: vi.fn((name: string) => systemModels.includes(name)),
  };
}

describe("ModelService", () => {
  it("rejects updates and deletes for code-defined system models", async () => {
    const { access, groups, models, remove } = dependencies();
    const service = new ModelService(models, access, compiledModels(["_sys_test"]), groups);

    await expect(service.update("_sys_test", schema("_sys_test"), "admin")).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.remove("_sys_test", "admin")).rejects.toMatchObject({ status: 403 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("records the authenticated creator instead of trusting submitted metadata", async () => {
    const { access, groups, models, publish } = dependencies();
    const service = new ModelService(models, access, compiledModels(), groups);

    await service.create({ ...schema(), creatorId: "spoofed", system: true }, "admin");

    expect(groups.assertValid).toHaveBeenCalledWith("other");
    expect(publish).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ creatorId: "admin", system: false, version: 1 }),
      0,
    );
  });

  it("publishes a newer system schema revision with optimistic locking", async () => {
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
    const publish = vi.fn(async (_current: AlienSchema | undefined, value: AlienSchema) => value);
    const models = {
      get: vi.fn().mockResolvedValue(current),
      publish,
    } as unknown as ModelRepository;
    const service = new ModelService(models, {} as AccessControl, compiledModels(["_sys_test"]), {
      assertValid: vi.fn(),
    });

    await service.ensureSystemModel(desired);

    expect(publish).toHaveBeenCalledWith(
      current,
      expect.objectContaining({ name: "_sys_test", version: 2 }),
      1,
    );
  });
});
