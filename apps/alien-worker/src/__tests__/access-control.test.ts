import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, AlienSchema } from "@alien-form/protocol";
import type { ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import { RoleAccessProfileProvider } from "../services/auth/access-profile-provider.ts";
import { AccessControl, type AccessControlOptions } from "../services/core/access-control.ts";
import roleModule from "../services/models/_sys_role/index.ts";

/** Creates a minimum business model for permission tests. */
function model(creatorId = "owner"): AlienSchema {
  return {
    name: "article",
    title: "文章",
    version: 1,
    creatorId,
    fields: [
      {
        id: "article.title",
        key: "title",
        type: "string",
        title: "标题",
        form: {},
      },
      {
        id: "article.secret",
        key: "secret",
        type: "string",
        title: "秘密",
        form: {},
      },
    ],
    form: {
      type: "object",
      properties: {
        title: { $ref: "#/fields/title" },
        secret: { $ref: "#/fields/secret" },
      },
    },
    pages: [],
  };
}

/** Creates stores backed by one user and an in-memory role tree. */
function stores(user: ModelRecord, roles: ModelRecord[]) {
  const schemas = new Map<string, AlienSchema>([
    [
      "_sys_user",
      {
        name: "_sys_user",
        title: "用户",
        version: 1,
        fields: [],
        form: { type: "object" },
        pages: [],
      },
    ],
    [
      "_sys_role",
      {
        name: "_sys_role",
        title: "角色",
        version: 1,
        fields: [],
        form: { type: "object" },
        pages: [],
      },
    ],
  ]);
  const models = {
    get: vi.fn(async (name: string) => schemas.get(name)),
  } as unknown as ModelStore;
  const records = {
    get: vi.fn(async (schema: AlienSchema, id: string) =>
      schema.name === "_sys_user" && id === user.id ? user : undefined,
    ),
    subtree: vi.fn(async () => roles),
  } as unknown as RecordStore;
  return { models, records };
}

function accessControl(
  models: ModelStore,
  records: RecordStore,
  options?: AccessControlOptions,
): AccessControl {
  return new AccessControl(new RoleAccessProfileProvider(models, records), options);
}

describe("AccessControl", () => {
  it("aggregates arbitrary descendant roles upward without role-code semantics", async () => {
    const roles: ModelRecord[] = [
      {
        id: "faculty",
        parentId: roleModule.constants.superAdminId,
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
    const service = accessControl(models, records);
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

    const profile = await accessControl(models, records).profile("student");

    expect(profile.roleIds).toEqual(["student-role", "monitor-role"]);
    expect(profile.permissions.get("article")).toEqual({
      actions: new Set(["read", "update"]),
      fields: new Set(["title", "secret"]),
      scope: "all",
    });
  });

  it("grants full access only from the fixed root id", async () => {
    const { models, records } = stores(
      { id: "root-user", roleId: [roleModule.constants.superAdminId] },
      [],
    );
    const profile = await accessControl(models, records).profile("root-user");

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
    const service = accessControl(models, records);
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
    const service = accessControl(models, records);
    const profile = await service.profile("builder");

    expect(service.scope(profile, model("builder"), "delete")).toBe("all");
    expect(service.scope(profile, model("other"), "delete")).toBeUndefined();
  });

  it("grants read-only access to models declared public by the composition root", () => {
    const { models, records } = stores({ id: "guest", roleId: [] }, []);
    const service = accessControl(models, records, {
      publicModelNames: new Set(["article"]),
    });
    const profile = {
      actorId: "guest",
      roleIds: [],
      permissions: new Map(),
      canCreateModel: false,
      super: false,
    };

    expect(service.scope(profile, model(), "read")).toBe("all");
    expect(service.scope(profile, model(), "update")).toBeUndefined();
  });

  it("projects pages and slotted action nodes by explicit permission", async () => {
    const { models, records } = stores({ id: "reader", roleId: ["reader-role"] }, [
      {
        id: "reader-role",
        permissions: [{ model: "article", actions: ["read"], fields: ["title"], scope: "all" }],
      },
    ]);
    const service = accessControl(models, records);
    const profile = await service.profile("reader");
    const schema: AlienSchema = {
      ...model(),
      pages: [
        {
          router: "list",
          permission: "read",
          type: "void",
          component: "layout",
          slots: {
            content: {
              table: {
                type: "void",
                component: "table",
                slots: {
                  toolbar: {
                    add: { type: "void", component: "record-action", permission: "create" },
                  },
                  rowActions: {
                    detail: { type: "void", component: "record-action", permission: "read" },
                    edit: { type: "void", component: "record-action", permission: "update" },
                    delete: { type: "void", component: "row-button", permission: "delete" },
                  },
                },
              },
            },
          },
        },
        {
          router: "edit",
          permission: "update",
          type: "void",
          properties: {},
        },
      ],
    };

    const projected = service.projectSchema(profile, schema);

    expect(projected.pages.map((page) => page.router)).toEqual(["list"]);
    expect(projected.pages[0]?.slots?.content?.table?.slots).toEqual({
      rowActions: {
        detail: { type: "void", component: "record-action", permission: "read" },
      },
    });
  });

  it("never exposes protocol-private fields, including to super administrators", () => {
    const { models, records } = stores({ id: "root", roleId: [] }, []);
    const service = accessControl(models, records);
    const schema = model();
    schema.fields.push({
      id: "article.internal",
      key: "internal",
      type: "string",
      private: true,
      form: {},
    });
    schema.form.properties!.internal = { $ref: "#/fields/internal" };

    const projected = service.projectSchema(
      {
        actorId: "root",
        roleIds: [],
        permissions: new Map(),
        canCreateModel: true,
        super: true,
      },
      schema,
    );

    expect(projected.fields.map((field) => field.key)).not.toContain("internal");
    expect(projected.form.properties).not.toHaveProperty("internal");
    expect(
      service.project(
        {
          actorId: "root",
          roleIds: [],
          permissions: new Map(),
          canCreateModel: true,
          super: true,
        },
        schema,
        { id: "1", title: "公开", internal: "内部" },
      ),
    ).toEqual({ id: "1", title: "公开" });
  });
});
