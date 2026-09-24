import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, AlienSchema } from "@alien-form/protocol";
import type {
  CompiledModelProvider,
  ModelValidationContext,
  RecordReader,
} from "../services/core/contracts.ts";
import roleModule from "../services/models/_sys_role/index.ts";
import { runtimeModel } from "./runtime-model.ts";

const roleSchema: AlienSchema = {
  name: roleModule.schema.name,
  title: "角色",
  version: 1,
  fields: [],
  form: { type: "object" },
  pages: [],
};

/** Creates a role validation context with controllable store results. */
function context(
  record: ModelRecord,
  options: {
    operation?: "create" | "update";
    parent?: ModelRecord;
    descendants?: ModelRecord[];
  } = {},
): ModelValidationContext {
  const model = runtimeModel(roleSchema);
  return {
    model,
    models: {
      get: vi.fn(async (name: string) =>
        name === "article"
          ? runtimeModel({
              name,
              title: "文章",
              version: 1,
              fields: [{ id: "article.title", key: "title", type: "string", form: {} }],
              form: { type: "object" },
              pages: [],
            })
          : undefined,
      ),
    } as unknown as CompiledModelProvider,
    records: {
      get: vi.fn(async () => options.parent),
      subtree: vi.fn(async () => options.descendants ?? []),
    } as unknown as RecordReader,
    actorId: "operator",
    operation: options.operation ?? "create",
    record: {
      code: "role",
      name: "角色",
      canCreateModel: false,
      ...record,
    },
  };
}

describe("_sys_role service", () => {
  it("requires a valid parent for every non-root role", async () => {
    const validate = roleModule.middleware.validate;

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
    const validate = roleModule.middleware.validate;

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
        context(
          { id: roleModule.constants.superAdminId, code: "super_admin" },
          { operation: "update" },
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects deleting a role with children or assigned users", async () => {
    const beforePersist = roleModule.middleware.beforePersist;
    const models = {
      get: vi.fn(async () => runtimeModel(roleSchema)),
    } as unknown as CompiledModelProvider;
    const records = {
      findByField: vi.fn().mockResolvedValueOnce({ id: "child" }),
    } as unknown as RecordReader;

    await expect(
      beforePersist({
        model: runtimeModel(roleSchema),
        models,
        records,
        actorId: "operator",
        operation: "delete",
        record: { id: "parent" },
        events: { emit: vi.fn() },
      }),
    ).rejects.toMatchObject({ status: 403 });

    vi.mocked(records.findByField)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "user" });
    await expect(
      beforePersist({
        model: runtimeModel(roleSchema),
        models,
        records,
        actorId: "operator",
        operation: "delete",
        record: { id: "role" },
        events: { emit: vi.fn() },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
