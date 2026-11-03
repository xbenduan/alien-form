import { describe, expect, it } from "vitest";
import {
  applyDefaults,
  assertDraftDefinition,
  assertManagedSnapshot,
  assertPublishedSnapshot,
  cloneJson,
  matchRoute,
  modelDocumentSchema,
  modelIssues,
  pointerSegments,
  readPointer,
  routePath,
  resolveModel,
  schemaAt,
  validateRoutes,
  validateValue,
} from "../index";
import type { DataSchema, ModelDocument } from "../index";

const document = (): ModelDocument => ({
  schemaVersion: 1,
  id: "orders",
  title: "订单",
  data: {
    title: { type: "string", minLength: 1, required: true },
    enabled: { type: "boolean", default: true },
    count: { type: "number", default: 9 },
    optional: { type: "string", nullable: true, default: "default" },
    address: { $ref: "#/$defs/address" },
    billing: { $ref: "#/$defs/address" },
  },
  $defs: {
    address: {
      type: "object",
      default: {},
      properties: { city: { type: "string", default: "杭州" } },
    },
  },
});

describe("完整模型契约", () => {
  it("接受共享引用，但 defaults 与 snapshot 不共享可变对象", () => {
    const model = { data: resolveModel(modelDocumentSchema.parse(document())).valueSchema };
    const value = applyDefaults(model.data, {
      title: "",
      enabled: false,
      count: 0,
      optional: null,
    }) as Record<string, unknown>;
    expect(value).toMatchObject({
      title: "",
      enabled: false,
      count: 0,
      optional: null,
      address: { city: "杭州" },
      billing: { city: "杭州" },
    });
    expect(value.address).not.toBe(value.billing);
    expect(schemaAt(model.data, "/address/city").schema).toMatchObject({ type: "string" });
    const copy = cloneJson(value as never);
    expect(copy).not.toBe(value);
    expect(validateValue(model.data, value).map((item) => item.path)).toContain("/title");
  });
  it.each([
    ["未知关键字", { title: { type: "string", oneOf: [] } }, "/data/title"],
    ["required", { title: { type: "string", required: ["missing"] } }, "/data/title/required"],
    [
      "范围倒置",
      { title: { type: "string", minLength: 3, maxLength: 1 } },
      "/data/title/maxLength",
    ],
    ["enum 类型", { enabled: { type: "boolean", enum: ["false"] } }, "/data/enabled/enum/0"],
    ["非法 default", { count: { type: "integer", default: 0.5 } }, "/data/count/default"],
    ["无效 regex", { title: { type: "string", pattern: "[" } }, "/data/title/pattern"],
    ["悬空引用", { item: { $ref: "#/$defs/nope" } }, "/data/item/$ref"],
  ])("诊断%s并保留 Pointer", (_name, override, path) => {
    const input = document();
    Object.assign(input.data, override);
    expect(modelIssues(input).some((issue) => issue.path === path)).toBe(true);
    expect(modelDocumentSchema.safeParse(input).success).toBe(false);
  });
  it("拒绝循环 ref、额外 envelope、旧布局与受控 props", () => {
    const input = document();
    input.$defs = { a: { $ref: "#/$defs/b" }, b: { $ref: "#/$defs/a" } };
    expect(modelIssues(input).some((issue) => issue.message.includes("循环"))).toBe(true);
    const plain = document();
    plain.data.title!.props = { value: "bad" };
    expect(modelIssues(plain).map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["/data/title/props/value"]),
    );
    expect(modelIssues({ ...document(), views: {} })).toContainEqual(
      expect.objectContaining({ path: "/views", code: "MIGRATION_REQUIRED" }),
    );
    expect(modelDocumentSchema.safeParse({ ...document(), revision: "x" }).success).toBe(false);
  });
  it("草稿允许不完整，发布和管理快照仍拒绝身份错误", () => {
    const snapshot = {
      id: "orders",
      title: "订单",
      revision: "opaque",
      stage: "draft",
      publishedVersion: null,
      baseVersion: null,
      canManage: true,
      canPublish: true,
      diagnostics: { errors: [], runtimeChecks: [] },
      definition: { id: "orders" },
    };
    expect(assertManagedSnapshot(snapshot, "orders").definition).toEqual({
      id: "orders",
    });
    expect(() => assertManagedSnapshot(snapshot, "cms")).toThrow();
    expect(() => assertPublishedSnapshot(snapshot, "orders")).toThrow();
    expect(() => assertDraftDefinition({ id: "cms" }, "orders")).toThrow();
    expect(() => assertDraftDefinition({ id: "orders", fn: () => 1 }, "orders")).toThrow();
  });
  it("可空 enum 仍约束 null；拒绝未声明字段和数组空洞", () => {
    const schema: DataSchema = { type: ["string", "null"], enum: ["yes"] };
    expect(validateValue(schema, null)[0]?.code).toBe("ENUM");
    expect(
      validateValue(resolveModel(document()).valueSchema, { extra: 1 }).map((item) => item.code),
    ).toEqual(["REQUIRED", "UNKNOWN_FIELD"]);
    const sparse: number[] = [];
    sparse.length = 2;
    expect(() => cloneJson(sparse)).toThrow();
    expect(() => cloneJson({ value: Number.NaN })).toThrow();
  });
});

describe("Pointer 与路由", () => {
  it("支持空根和 escaped 字段，但不沿 prototype 读取", () => {
    expect(pointerSegments("/a~1b/~0x")).toEqual(["a/b", "~x"]);
    expect(readPointer({ "a/b": { "~x": 2 } }, "/a~1b/~0x")).toBe(2);
    expect(readPointer({}, "/constructor")).toBeUndefined();
    expect(readPointer([1], "/01")).toBeUndefined();
    expect(() => pointerSegments("/bad~2")).toThrow();
    expect(readPointer(false, "")).toBe(false);
  });
  const routes = [
    { router: "home" },
    { router: "models", path: "/models/:modelId?" },
    { router: "list", path: "/list/:modelId" },
    { router: "featured", path: "/list/featured" },
    {
      router: "list",
      window: "edit",
      path: "/list/:modelId/edit/:id",
      openMode: "drawer" as const,
    },
  ];
  it("按段编码参数，固定路径优先，缺少必填 id 不伪造数据", () => {
    validateRoutes(routes);
    expect(
      routePath(routes, { router: "list", window: "edit" }, { modelId: "orders", id: "a/b 中文" }),
    ).toBe("/list/orders/edit/a%2Fb%20%E4%B8%AD%E6%96%87");
    expect(matchRoute(routes, "/list/orders/edit/a%2Fb")?.params.id).toBe("a/b");
    expect(matchRoute(routes, "/list/featured")?.definition.router).toBe("featured");
    expect(matchRoute(routes, "/models")?.params).toEqual({});
    expect(() =>
      routePath(routes, { router: "list", window: "edit" }, { modelId: "orders" }),
    ).toThrow(/id/u);
    expect(() => routePath(routes, "unknown")).toThrow();
    expect(() => routePath(routes, "list", { modelId: "../cms" })).toThrow();
  });
  it("拒绝歧义和缺少所属 Page 参数的 Window", () => {
    expect(() => validateRoutes([...routes, { router: "other", path: "/list/:model" }])).toThrow(
      /歧义/u,
    );
    expect(() =>
      validateRoutes([
        { router: "list", path: "/list/:modelId" },
        { router: "list", window: "edit", path: "/edit/:id", openMode: "modal" },
      ]),
    ).toThrow(/参数/u);
  });
});
