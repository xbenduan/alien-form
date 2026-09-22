import { describe, expect, it, vi } from "vitest";
import { ensureBootstrapped } from "./bootstrap.ts";
import type { Container } from "./container.ts";
import { sysUserSchema } from "./domain/schemas/_sys_user.ts";
import { ModelRegistry } from "./register/registry.ts";

/** Creates the minimum container surface needed by bootstrap tests. */
function createContainer() {
  const models = new ModelRegistry();
  models.model(sysUserSchema.name, { schema: sysUserSchema });
  const ensureSystemModel = vi.fn().mockResolvedValue(sysUserSchema);
  const create = vi.fn();
  const update = vi.fn();
  const container = {
    models,
    modelStore: { get: vi.fn().mockResolvedValue(sysUserSchema) },
    modelService: { ensureSystemModel },
    recordStore: {
      get: vi.fn().mockResolvedValue({ id: "existing", roleId: ["SYSROLE000001"], super: true }),
      findByField: vi.fn(),
    },
    recordService: { create, update },
  } as unknown as Container;
  return { container, create, ensureSystemModel, update };
}

describe("ensureBootstrapped", () => {
  it("synchronizes every registered system schema", async () => {
    const { container, ensureSystemModel } = createContainer();

    await ensureBootstrapped(container);

    expect(ensureSystemModel).toHaveBeenCalledWith(sysUserSchema);
  });

  it("migrates missing role hierarchy fields without recreating seed records", async () => {
    const { container, create, update } = createContainer();

    await ensureBootstrapped(container);

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
