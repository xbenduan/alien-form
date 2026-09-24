import { describe, expect, it, vi } from "vitest";
import type { ModelDatabaseContext } from "@alien-form/alienbase";
import { createCoreInitializer, type WorkerCore } from "../bootstrap/core.ts";
import roleModule from "../models/_sys_role/index.ts";
import userModule from "../models/_sys_user/index.ts";
import { runtimeModel } from "./runtime-model.ts";

function createRuntime(): WorkerCore {
  return { initialize: vi.fn().mockResolvedValue(undefined) } as unknown as WorkerCore;
}

function createDatabaseContext(): {
  context: ModelDatabaseContext;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn();
  const update = vi.fn();
  const compiled = runtimeModel(userModule.schema);
  return {
    create,
    update,
    context: {
      models: { get: vi.fn().mockResolvedValue(compiled) },
      records: {
        get: vi.fn().mockResolvedValue({
          id: "existing",
          roleId: ["SYSROLE000001"],
          super: true,
        }),
        findByField: vi.fn(),
      },
      create,
      update,
    },
  };
}

describe("core initialization", () => {
  it("initializes only once for concurrent requests", async () => {
    const first = createRuntime();
    const second = createRuntime();
    const initialize = createCoreInitializer();

    await Promise.all([initialize(first), initialize(second)]);
    await initialize(second);

    expect(first.initialize).toHaveBeenCalledTimes(1);
    expect(second.initialize).not.toHaveBeenCalled();
  });

  it("retries initialization after a failure", async () => {
    const first = {
      initialize: vi.fn().mockRejectedValueOnce(new Error("bootstrap failed")),
    } as unknown as WorkerCore;
    const second = createRuntime();
    const initialize = createCoreInitializer();

    await expect(initialize(first)).rejects.toThrow("bootstrap failed");
    await initialize(second);

    expect(first.initialize).toHaveBeenCalledTimes(1);
    expect(second.initialize).toHaveBeenCalledTimes(1);
  });

  it("migrates missing role hierarchy fields without recreating seed records", async () => {
    const { context, create, update } = createDatabaseContext();

    await roleModule.database.initialize(context);

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
