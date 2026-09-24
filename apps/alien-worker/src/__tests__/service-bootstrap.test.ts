import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.ts";
import { createModelModulesBootstrap, ensureModelModules } from "../services/bootstrap.ts";
import { ModelModules } from "../services/model-modules.ts";
import roleModule from "../services/models/_sys_role/index.ts";
import userModule from "../services/models/_sys_user/index.ts";
import { runtimeModel } from "./runtime-model.ts";

/** Creates the minimum container surface needed by service initialization tests. */
function createContainer(modules = ModelModules.from([userModule])) {
  const ensureSystemModel = vi.fn().mockResolvedValue(userModule.schema);
  const create = vi.fn();
  const update = vi.fn();
  const compiled = runtimeModel(userModule.schema);
  const container = {
    modules,
    compiledModels: { get: vi.fn().mockResolvedValue(compiled) },
    modelService: { ensureSystemModel },
    recordStore: {
      get: vi.fn().mockResolvedValue({ id: "existing", roleId: ["SYSROLE000001"], super: true }),
      findByField: vi.fn(),
    },
    recordService: { create, update },
  } as unknown as Container;
  const databaseContext = {
    models: container.compiledModels,
    records: container.recordStore,
    create,
    update,
  };
  return { container, create, databaseContext, ensureSystemModel, update };
}

describe("service initialization", () => {
  it("synchronizes every convention-loaded system schema", async () => {
    const { container, ensureSystemModel } = createContainer();

    await ensureModelModules(container);

    expect(ensureSystemModel).toHaveBeenCalledWith(userModule.schema);
  });

  it("initializes model modules only once for concurrent requests", async () => {
    const first = createContainer();
    const second = createContainer();
    const bootstrap = createModelModulesBootstrap();

    await Promise.all([bootstrap(first.container), bootstrap(second.container)]);
    await bootstrap(second.container);

    expect(first.ensureSystemModel).toHaveBeenCalledTimes(1);
    expect(second.ensureSystemModel).not.toHaveBeenCalled();
  });

  it("retries model initialization after a failure", async () => {
    const first = createContainer();
    const second = createContainer();
    const bootstrap = createModelModulesBootstrap();
    first.ensureSystemModel.mockRejectedValueOnce(new Error("bootstrap failed"));

    await expect(bootstrap(first.container)).rejects.toThrow("bootstrap failed");
    await bootstrap(second.container);

    expect(first.ensureSystemModel).toHaveBeenCalledTimes(1);
    expect(second.ensureSystemModel).toHaveBeenCalledTimes(1);
  });

  it("migrates missing role hierarchy fields without recreating seed records", async () => {
    const { create, databaseContext, update } = createContainer();

    await roleModule.database.initialize(databaseContext);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      "_sys_role",
      "SYSROLE000002",
      { parentId: "SYSROLE000001", canCreateModel: true },
      "MDM0000000000",
    );
    expect(update).toHaveBeenCalledWith(
      "_sys_role",
      "SYSROLE000003",
      { parentId: "SYSROLE000001", canCreateModel: false },
      "MDM0000000000",
    );
  });
});
