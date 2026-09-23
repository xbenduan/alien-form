import { describe, expect, it, vi } from "vitest";
import { parseAlienSchema, type ModelRecord, type AlienSchema } from "@alien-form/protocol";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { ModelValidationContext } from "../services/types.ts";
import roleModule from "../services/models/_sys_role/index.ts";
import userModule from "../services/models/_sys_user/index.ts";

/** Creates a user validation context backed by a set of existing role IDs. */
function context(record: ModelRecord, roleIds: string[]): ModelValidationContext {
  const roleSchema = { name: roleModule.schema.name, fields: [] } as unknown as AlienSchema;
  return {
    model: { name: userModule.schema.name } as AlienSchema,
    models: {
      get: vi.fn(async (name: string) =>
        name === roleModule.schema.name ? roleSchema : undefined,
      ),
    } as unknown as ModelStore,
    records: {
      get: vi.fn(async (_schema: AlienSchema, id: string) =>
        roleIds.includes(id) ? { id } : undefined,
      ),
    } as unknown as RecordStore,
    actorId: userModule.constants.adminId,
    operation: "create",
    record: {
      username: "student",
      roleId: [],
      ...record,
    },
  };
}

describe("_sys_user service", () => {
  it("declares the user role as a required many-to-many field", () => {
    expect(() => parseAlienSchema(userModule.schema)).not.toThrow();
    expect(userModule.schema.fields.find((field) => field.key === "passwordHash")).toMatchObject({
      private: true,
    });
    expect(userModule.schema.fields.find((field) => field.key === "roleId")).toMatchObject({
      type: "array",
      required: true,
      storage: { type: "json" },
      relation: { kind: "many-to-many", through: "_sys_user_roles" },
      form: { component: "RemoteSelect" },
    });
  });

  it("normalizes duplicate role IDs and forces the root role for the system administrator", async () => {
    const prepare = userModule.middleware.prepare;

    await expect(
      prepare(
        { id: "user", username: "student", roleId: ["student", "student", "monitor"] },
        { actorId: userModule.constants.adminId, operation: "update" },
      ),
    ).resolves.toMatchObject({ roleId: ["student", "monitor"], super: false });
    await expect(
      prepare(
        { id: userModule.constants.adminId, username: "_sys_admin", roleId: ["student"] },
        { actorId: userModule.constants.adminId, operation: "update" },
      ),
    ).resolves.toMatchObject({ roleId: [roleModule.constants.superAdminId], super: true });
  });

  it("requires at least one existing role", async () => {
    const validate = userModule.middleware.validate;

    await expect(validate(context({ id: "user", roleId: [] }, []))).rejects.toThrow(
      "至少一个有效角色",
    );
    await expect(
      validate(context({ id: "user", roleId: ["student", "missing"] }, ["student"])),
    ).rejects.toThrow("不存在的角色");
  });

  it("reserves the root role for the system administrator", async () => {
    const validate = userModule.middleware.validate;

    await expect(
      validate(
        context({ id: "user", username: "operator", roleId: [roleModule.constants.superAdminId] }, [
          roleModule.constants.superAdminId,
        ]),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
