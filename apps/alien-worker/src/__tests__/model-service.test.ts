import { describe, expect, it, vi } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import type { AccessControl } from "@alien-form/alienbase";
import type {
  CodeModelCatalog,
  CompiledModelProvider,
  ModelRepository,
} from "@alien-form/alienbase";
import { ModelService, type ModelGroupPolicy } from "@alien-form/alienbase";

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
    projectSchema: vi.fn((_profile, value) => value),
  } as unknown as AccessControl;
  const groups = {
    assertValid: vi.fn(),
  } satisfies ModelGroupPolicy;
  return { access, groups, models, publish, remove };
}

function codeModels(schemas: AlienSchema[] = []): CodeModelCatalog {
  return {
    list: vi.fn().mockResolvedValue(schemas),
    has: vi.fn(async (name: string) => schemas.some((item) => item.name === name)),
  };
}

function compiledModels(schemas: AlienSchema[] = []): CompiledModelProvider {
  return {
    get: vi.fn(async (name: string) => {
      const value = schemas.find((item) => item.name === name);
      return value ? ({ schema: value } as never) : undefined;
    }),
    require: vi.fn(),
    invalidate: vi.fn(),
  };
}

describe("ModelService", () => {
  it("rejects updates and deletes for code-defined system models", async () => {
    const { access, groups, models, remove } = dependencies();
    const systemSchema = schema("_sys_test");
    const service = new ModelService(
      models,
      codeModels([systemSchema]),
      access,
      compiledModels([systemSchema]),
      groups,
    );

    await expect(service.update("_sys_test", schema("_sys_test"), "admin")).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.remove("_sys_test", "admin")).rejects.toMatchObject({ status: 403 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("records the authenticated creator instead of trusting submitted metadata", async () => {
    const { access, groups, models, publish } = dependencies();
    const service = new ModelService(models, codeModels(), access, compiledModels(), groups);

    await service.create({ ...schema(), creatorId: "spoofed", system: true }, "admin");

    expect(groups.assertValid).toHaveBeenCalledWith("other");
    expect(publish).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ creatorId: "admin", system: false, version: 1 }),
      0,
    );
  });

  it("serves code schemas without reading persisted model metadata", async () => {
    const systemSchema = { ...schema("_sys_test"), version: 1, system: true };
    const { access, groups, models } = dependencies();
    const service = new ModelService(
      models,
      codeModels([systemSchema]),
      access,
      compiledModels([systemSchema]),
      groups,
    );

    await expect(service.get(systemSchema.name, "admin")).resolves.toEqual(systemSchema);
    expect(models.get).not.toHaveBeenCalled();
  });

  it("lists code models once and ignores stale persisted copies", async () => {
    const systemSchema = { ...schema("_sys_test"), version: 1, system: true };
    const { access, groups, models } = dependencies();
    vi.mocked(models.list).mockResolvedValue([
      {
        name: systemSchema.name,
        title: "数据库旧副本",
        version: 99,
        fieldCount: 0,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const service = new ModelService(
      models,
      codeModels([systemSchema]),
      access,
      compiledModels([systemSchema]),
      groups,
    );

    await expect(service.list("admin")).resolves.toEqual([
      expect.objectContaining({ name: systemSchema.name, title: "文章", system: true }),
    ]);
  });

  it("reserves code model names for system models", async () => {
    const systemSchema = schema("_sys_test");
    const { access, groups, models } = dependencies();
    const service = new ModelService(
      models,
      codeModels([systemSchema]),
      access,
      compiledModels([systemSchema]),
      groups,
    );

    await expect(service.create(schema("_sys_test"), "admin")).rejects.toMatchObject({
      status: 409,
    });
    expect(models.has).not.toHaveBeenCalled();
  });
});
