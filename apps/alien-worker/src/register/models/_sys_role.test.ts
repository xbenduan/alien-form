import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, AlienSchema } from "@alien-form/protocol";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "../../domain/schemas/_sys_role.ts";
import type { ModelStore } from "../../store/model-store.ts";
import type { RecordStore } from "../../store/record-store.ts";
import { ModelRegistry, type ModelValidationContext } from "../registry.ts";
import { registerSysRole } from "./_sys_role.ts";

const roleSchema: AlienSchema = {
  name: SYS_ROLE_MODEL,
  title: "角色",
  version: 1,
  fields: [],
  form: { type: "object" },
  pages: [],
};

/** Returns the registered role rules for focused invariant tests. */
function registration() {
  const registry = new ModelRegistry();
  registerSysRole(registry);
  return registry.get(SYS_ROLE_MODEL)!;
}

/** Creates a role validation context with controllable store results. */
function context(
  record: ModelRecord,
  options: {
    operation?: "create" | "update";
    parent?: ModelRecord;
    descendants?: ModelRecord[];
  } = {},
): ModelValidationContext {
  return {
    model: roleSchema,
    models: {
      get: vi.fn(async (name: string) =>
        name === "article"
          ? {
              name,
              title: "文章",
              version: 1,
              fields: [{ id: "article.title", key: "title", type: "string", form: {} }],
              form: { type: "object" },
              pages: [],
            }
          : undefined,
      ),
    } as unknown as ModelStore,
    records: {
      get: vi.fn(async () => options.parent),
      subtree: vi.fn(async () => options.descendants ?? []),
    } as unknown as RecordStore,
    actorId: "operator",
    operation: options.operation ?? "create",
    record,
  };
}

describe("_sys_role registration", () => {
  it("requires a valid parent for every non-root role", async () => {
    const validate = registration().validate!;

    await expect(
      validate(context({ id: "student", code: "student", name: "学生" })),
    ).rejects.toThrow("非根角色必须选择父级角色");
    await expect(
      validate(
        context(
          { id: "student", code: "student", name: "学生", parentId: "root" },
          { parent: { id: "root" } },
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects cycles and updates to the fixed root", async () => {
    const validate = registration().validate!;

    await expect(
      validate(
        context(
          { id: "faculty", parentId: "student" },
          {
            operation: "update",
            parent: { id: "student" },
            descendants: [{ id: "student", parentId: "faculty" }],
          },
        ),
      ),
    ).rejects.toThrow("后代节点");
    await expect(
      validate(
        context({ id: SYS_ROLE_SUPER_ADMIN_ID, code: "super_admin" }, { operation: "update" }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects deleting a role with children or assigned users", async () => {
    const beforeDelete = registration().hooks?.beforeDelete;
    if (!beforeDelete) throw new Error("beforeDelete hook 未注册");
    const models = {
      get: vi.fn(async () => ({ name: "_sys_user", fields: [] })),
    } as unknown as ModelStore;
    const records = {
      findByField: vi.fn().mockResolvedValueOnce({ id: "child" }),
    } as unknown as RecordStore;

    await expect(
      beforeDelete({
        model: roleSchema,
        models,
        records,
        actorId: "operator",
        operation: "delete",
        record: { id: "parent" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    vi.mocked(records.findByField)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "user" });
    await expect(
      beforeDelete({
        model: roleSchema,
        models,
        records,
        actorId: "operator",
        operation: "delete",
        record: { id: "role" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
