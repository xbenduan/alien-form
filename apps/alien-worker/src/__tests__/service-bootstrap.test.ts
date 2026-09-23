import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.ts";
import { ensureModelModules } from "../services/bootstrap.ts";
import { ModelModules } from "../services/model-modules.ts";
import roleModule from "../services/models/_sys_role/index.ts";
import userModule from "../services/models/_sys_user/index.ts";

/** Creates the minimum container surface needed by service initialization tests. */
function createContainer(modules = ModelModules.from([userModule])) {
  const ensureSystemModel = vi.fn().mockResolvedValue(userModule.schema);
  const create = vi.fn();
  const update = vi.fn();
  const container = {
    modules,
    modelStore: { get: vi.fn().mockResolvedValue(userModule.schema) },
    modelService: { ensureSystemModel },
    recordStore: {
      get: vi.fn().mockResolvedValue({ id: "existing", roleId: ["SYSROLE000001"], super: true }),
      findByField: vi.fn(),
    },
    recordService: { create, update },
  } as unknown as Container;
  return { container, create, ensureSystemModel, update };
}

describe("service initialization", () => {
  it("synchronizes every convention-loaded system schema", async () => {
    const { container, ensureSystemModel } = createContainer();

    await ensureModelModules(container);

    expect(ensureSystemModel).toHaveBeenCalledWith(userModule.schema);
  });

  it("migrates missing role hierarchy fields without recreating seed records", async () => {
    const { container, create, update } = createContainer();

    await roleModule.database.initialize(container);

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
