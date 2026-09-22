import { describe, expect, it, vi } from "vitest";
import { parseModelSchema, type ModelRecord, type ModelSchema } from "@alien-form/protocol";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "../../domain/schemas/_sys_role.ts";
import { SYS_ADMIN_ID, SYS_USER_MODEL, sysUserSchema } from "../../domain/schemas/_sys_user.ts";
import type { ModelStore } from "../../store/model-store.ts";
import type { RecordStore } from "../../store/record-store.ts";
import { ModelRegistry, type ModelValidationContext } from "../registry.ts";
import { registerSysUser } from "./_sys_user.ts";

/** Returns the registered user rules for focused invariant tests. */
function registration() {
  const registry = new ModelRegistry();
  registerSysUser(registry);
  return registry.get(SYS_USER_MODEL)!;
}

/** Creates a user validation context backed by a set of existing role IDs. */
function context(record: ModelRecord, roleIds: string[]): ModelValidationContext {
  const roleSchema = { name: SYS_ROLE_MODEL, fields: [] } as unknown as ModelSchema;
  return {
    model: { name: SYS_USER_MODEL } as ModelSchema,
    models: {
      get: vi.fn(async (name: string) => (name === SYS_ROLE_MODEL ? roleSchema : undefined)),
    } as unknown as ModelStore,
    records: {
      get: vi.fn(async (_schema: ModelSchema, id: string) =>
        roleIds.includes(id) ? { id } : undefined,
      ),
    } as unknown as RecordStore,
    actorId: SYS_ADMIN_ID,
    operation: "create",
    record,
  };
}

describe("_sys_user registration", () => {
  it("declares the user role as a required many-to-many field", () => {
    expect(() => parseModelSchema(sysUserSchema)).not.toThrow();
    expect(sysUserSchema.fields.find((field) => field.key === "roleId")).toMatchObject({
      database: { type: "json", valueType: "array", nullable: false },
      relation: { kind: "many-to-many", through: "_sys_user_roles" },
      form: { type: "array", required: true, props: { multiple: true } },
    });
  });

  it("normalizes duplicate role IDs and forces the root role for the system administrator", async () => {
    const transform = registration().transform!;

    await expect(
      transform(
        { id: "user", username: "student", roleId: ["student", "student", "monitor"] },
        { actorId: SYS_ADMIN_ID, operation: "update" },
      ),
    ).resolves.toMatchObject({ roleId: ["student", "monitor"], super: false });
    await expect(
      transform(
        { id: SYS_ADMIN_ID, username: "_sys_admin", roleId: ["student"] },
        { actorId: SYS_ADMIN_ID, operation: "update" },
      ),
    ).resolves.toMatchObject({ roleId: [SYS_ROLE_SUPER_ADMIN_ID], super: true });
  });

  it("requires at least one existing role", async () => {
    const validate = registration().validate!;

    await expect(validate(context({ id: "user", roleId: [] }, []))).rejects.toThrow(
      "至少一个有效角色",
    );
    await expect(
      validate(context({ id: "user", roleId: ["student", "missing"] }, ["student"])),
    ).rejects.toThrow("不存在的角色");
  });

  it("reserves the root role for the system administrator", async () => {
    const validate = registration().validate!;

    await expect(
      validate(
        context({ id: "user", username: "operator", roleId: [SYS_ROLE_SUPER_ADMIN_ID] }, [
          SYS_ROLE_SUPER_ADMIN_ID,
        ]),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
