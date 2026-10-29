import { describe, expect, it } from "vitest";
import { applyDefaults, assertSnapshot, cloneJson, createReadonlyModelSource, matchRoute, modelDocumentSchema, modelIssues, pointerSegments, readPointer, routePath, schemaAt, validateRoutes, validateValue } from "../index";
import type { DataSchema, ModelDocument } from "../index";

const document = (): ModelDocument => ({
  id: "orders", title: "订单",
  data: { type: "object", properties: {
    title: { type: "string", minLength: 1 },
    enabled: { type: "boolean", default: true },
    count: { type: "number", default: 9 },
    optional: { type: ["string", "null"], default: "default" },
    address: { $ref: "#/$defs/address" },
    billing: { $ref: "#/$defs/address" },
  }, required: ["title"], $defs: {
    address: { type: "object", properties: { city: { type: "string", default: "杭州" } } },
  } },
});

describe("完整模型契约", () => {
  it("接受共享引用，但 defaults 与 snapshot 不共享可变对象", () => {
    const model = modelDocumentSchema.parse(document());
    const value = applyDefaults(model.data, { title: "", enabled: false, count: 0, optional: null }) as Record<string, unknown>;
    expect(value).toMatchObject({ title: "", enabled: false, count: 0, optional: null, address: { city: "杭州" }, billing: { city: "杭州" } });
    expect(value.address).not.toBe(value.billing);
    expect(schemaAt(model.data, "/address/city").schema).toMatchObject({ type: "string" });
    const copy = cloneJson(value as never);
    expect(copy).not.toBe(value);
    expect(validateValue(model.data, value).map((item) => item.path)).toContain("/title");
  });
  it.each([
    ["未知关键字", { oneOf: [] }, "/data/oneOf"],
    ["required", { required: ["missing"] }, "/data/required"],
    ["范围倒置", { properties: { title: { type: "string", minLength: 3, maxLength: 1 } } }, "/data/properties/title/maxLength"],
    ["enum 类型", { properties: { enabled: { type: "boolean", enum: ["false"] } } }, "/data/properties/enabled/enum/0"],
    ["非法 default", { properties: { count: { type: "integer", default: 0.5 } } }, "/data/properties/count/default"],
    ["无效 regex", { properties: { title: { type: "string", pattern: "[" } } }, "/data/properties/title/pattern"],
    ["悬空引用", { properties: { item: { $ref: "#/$defs/nope" } } }, "/data/properties/item/$ref"],
  ])("诊断%s并保留 Pointer", (_name, override, path) => {
    const input = document();
    Object.assign(input.data, override);
    expect(modelIssues(input).some((issue) => issue.path === path)).toBe(true);
    expect(modelDocumentSchema.safeParse(input).success).toBe(false);
  });
  it("拒绝循环 ref、额外 envelope、受控 props 与非法表达式", () => {
    const input = document();
    input.data.$defs = { a: { $ref: "#/$defs/b" }, b: { $ref: "#/$defs/a" } };
    expect(modelIssues(input).some((issue) => issue.message.includes("循环"))).toBe(true);
    const plain = document();
    plain.views = { edit: { component: "Input", field: "/title", props: { value: "bad", title: "{{ ( }}" } } };
    expect(modelIssues(plain).map((issue) => issue.path)).toEqual(expect.arrayContaining(["/views/edit/props/value", "/views/edit/props/title"]));
    expect(modelDocumentSchema.safeParse({ ...document(), revision: "x" }).success).toBe(false);
  });
  it("拒绝权限投影与 id 不一致", () => {
    const snapshot = { id: "orders", title: "订单", revision: "opaque", writable: true, location: { kind: "local", path: "model.json" }, completeness: "full", document: document() };
    expect(assertSnapshot(snapshot, "orders").document).toEqual(document());
    expect(() => assertSnapshot({ ...snapshot, completeness: "projected" })).toThrow();
    expect(() => assertSnapshot(snapshot, "cms")).toThrow();
  });
  it("可空 enum 仍约束 null；拒绝未声明字段和数组空洞", () => {
    const schema: DataSchema = { type: ["string", "null"], enum: ["yes"] };
    expect(validateValue(schema, null)[0]?.code).toBe("ENUM");
    expect(validateValue(document().data, { extra: 1 }).map((item) => item.code)).toEqual(["REQUIRED", "UNKNOWN_FIELD"]);
    const sparse: number[] = [];
    sparse.length = 2;
    expect(() => cloneJson(sparse)).toThrow();
    expect(() => cloneJson({ value: Number.NaN })).toThrow();
  });
  it("生产源保持完整且拒绝写入，读取结果之间不共享对象", async () => {
    const source = createReadonlyModelSource([{ id: "orders", title: "订单", revision: "opaque", writable: true, location: { kind: "local", path: "model.json" }, completeness: "full", document: document() }]);
    const first = await source.read("orders");
    first.document.title = "mutated";
    expect((await source.read("orders")).document.title).toBe("订单");
    expect((await source.list())[0]?.writable).toBe(false);
    await expect(source.write(document(), { ifRevision: "opaque" })).rejects.toMatchObject({ code: "READ_ONLY" });
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
    { router: "models", path: "/models/:domain?" },
    { router: "list", path: "/list/:domain" },
    { router: "featured", path: "/list/featured" },
    { router: "edit", path: "/edit/:domain/:id", presentation: "drawer" as const, returnTo: "list" },
  ];
  it("按段编码参数，固定路径优先，缺少必填 id 不伪造数据", () => {
    validateRoutes(routes);
    expect(routePath(routes, "edit", { domain: "orders", id: "a/b 中文" })).toBe("/edit/orders/a%2Fb%20%E4%B8%AD%E6%96%87");
    expect(matchRoute(routes, "/edit/orders/a%2Fb")?.params.id).toBe("a/b");
    expect(matchRoute(routes, "/list/featured")?.definition.router).toBe("featured");
    expect(matchRoute(routes, "/models")?.params).toEqual({});
    expect(() => routePath(routes, "edit", { domain: "orders" })).toThrow(/id/u);
    expect(() => routePath(routes, "unknown")).toThrow();
    expect(() => routePath(routes, "list", { domain: "../cms" })).toThrow();
  });
  it("拒绝歧义和无法填充 returnTo 的 Window", () => {
    expect(() => validateRoutes([...routes, { router: "other", path: "/list/:model" }])).toThrow(/歧义/u);
    expect(() => validateRoutes([{ router: "list", path: "/list/:domain" }, { router: "edit", path: "/edit/:id", presentation: "modal", returnTo: "list" }])).toThrow(/参数/u);
  });
});
