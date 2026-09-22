import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, ModelSchema } from "@alien-form/protocol";
import { SYS_ROLE_SUPER_ADMIN_ID } from "../domain/schemas/_sys_role.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import { AuthorizationService } from "./authorization-service.ts";

/** Creates a minimum business model for permission tests. */
function model(creatorId = "owner"): ModelSchema {
  return {
    name: "article",
    title: "文章",
    version: 1,
    creatorId,
    fields: [
      {
        id: "article.title",
        key: "title",
        storage: "virtual",
        form: { type: "string", title: "标题" },
      },
      {
        id: "article.secret",
        key: "secret",
        storage: "virtual",
        form: { type: "string", title: "秘密" },
      },
    ],
    pages: [],
  };
}

/** Creates stores backed by one user and an in-memory role tree. */
function stores(user: ModelRecord, roles: ModelRecord[]) {
  const schemas = new Map<string, ModelSchema>([
    ["_sys_user", { name: "_sys_user", title: "用户", version: 1, fields: [], pages: [] }],
    ["_sys_role", { name: "_sys_role", title: "角色", version: 1, fields: [], pages: [] }],
  ]);
  const models = {
    get: vi.fn(async (name: string) => schemas.get(name)),
  } as unknown as ModelStore;
  const records = {
    get: vi.fn(async (schema: ModelSchema, id: string) =>
      schema.name === "_sys_user" && id === user.id ? user : undefined,
    ),
    subtree: vi.fn(async () => roles),
  } as unknown as RecordStore;
  return { models, records };
}

describe("AuthorizationService", () => {
  it("aggregates arbitrary descendant roles upward without role-code semantics", async () => {
    const roles: ModelRecord[] = [
      {
        id: "faculty",
        parentId: SYS_ROLE_SUPER_ADMIN_ID,
        canCreateModel: false,
        permissions: [
          {
            model: "article",
            actions: ["read"],
            fields: ["title"],
            scope: "own",
          },
        ],
      },
      {
        id: "counselor",
        parentId: "faculty",
        canCreateModel: true,
        permissions: [
          {
            model: "article",
            actions: ["update"],
            fields: ["secret"],
            scope: "all",
          },
        ],
      },
      {
        id: "student",
        parentId: "counselor",
        permissions: [
          {
            model: "article",
            actions: ["delete"],
            fields: [],
            scope: "own",
          },
        ],
      },
    ];
    const { models, records } = stores({ id: "teacher", roleId: ["faculty"] }, roles);
    const service = new AuthorizationService(models, records);
    const profile = await service.profile("teacher");

    expect(profile.canCreateModel).toBe(true);
    expect(profile.permissions.get("article")).toEqual({
      actions: new Set(["read", "update", "delete"]),
      fields: new Set(["title", "secret"]),
      scope: "all",
    });
    expect(service.scope(profile, model(), "create")).toBeUndefined();
    expect(service.scope(profile, model(), "update")).toBe("all");
  });

  it("merges permissions from every directly assigned role", async () => {
    const roles: ModelRecord[] = [
      {
        id: "student-role",
        permissions: [{ model: "article", actions: ["read"], fields: ["title"], scope: "own" }],
      },
      {
        id: "monitor-role",
        permissions: [
          { model: "article", actions: ["read", "update"], fields: ["secret"], scope: "all" },
        ],
      },
    ];
    const { models, records } = stores(
      { id: "student", roleId: ["student-role", "monitor-role"] },
      roles,
    );

    const profile = await new AuthorizationService(models, records).profile("student");

    expect(profile.roleIds).toEqual(["student-role", "monitor-role"]);
    expect(profile.permissions.get("article")).toEqual({
      actions: new Set(["read", "update"]),
      fields: new Set(["title", "secret"]),
      scope: "all",
    });
  });

  it("grants full access only from the fixed root id", async () => {
    const { models, records } = stores({ id: "root-user", roleId: [SYS_ROLE_SUPER_ADMIN_ID] }, []);
    const profile = await new AuthorizationService(models, records).profile("root-user");

    expect(profile.super).toBe(true);
    expect(profile.canCreateModel).toBe(true);
  });

  it("projects records to explicitly granted fields", async () => {
    const { models, records } = stores({ id: "student", roleId: ["student-role"] }, [
      {
        id: "student-role",
        permissions: [
          {
            model: "article",
            actions: ["read"],
            fields: ["title"],
            scope: "own",
          },
        ],
      },
    ]);
    const service = new AuthorizationService(models, records);
    const profile = await service.profile("student");

    expect(service.canRead(profile, model())).toBe(true);
    expect(
      service.project(profile, model(), {
        id: "1",
        title: "允许",
        secret: "禁止",
        createdAt: 1,
      }),
    ).toEqual({ id: "1", title: "允许", createdAt: 1 });
  });

  it("lets model creators manage only models they own when capability is inherited", async () => {
    const { models, records } = stores({ id: "builder", roleId: ["builder-role"] }, [
      { id: "builder-role", canCreateModel: true },
    ]);
    const service = new AuthorizationService(models, records);
    const profile = await service.profile("builder");

    expect(service.scope(profile, model("builder"), "delete")).toBe("all");
    expect(service.scope(profile, model("other"), "delete")).toBeUndefined();
  });
});
