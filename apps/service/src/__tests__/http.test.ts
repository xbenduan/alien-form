import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHttpModelSource } from "formwork/model";
import { createDevelopmentService } from "../app";
import { seedDevelopment } from "../seed";

const roots: string[] = [];
const services: ReturnType<typeof createDevelopmentService>[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(root?: string) {
  root ??= await mkdtemp(join(tmpdir(), "formwork-service-"));
  roots.push(root);
  const service = createDevelopmentService(root);
  services.push(service);
  await seedDevelopment(service, [
    resolve("apps/client/src/models/orders/model.json"),
    resolve("apps/client/src/domains/cms/model.json"),
  ]);
  const origin = await service.listen(0);
  const source = createHttpModelSource({
    url: `${origin}/api/models`,
    headers: { "x-formwork-tool": "1" },
  });
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    headers = { "x-formwork-tool": "1" },
  ) =>
    fetch(`${origin}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { root, service, origin, source, request };
}
it("HTTP 完整远端源服务端 CAS、非法模型不写入、重启不覆盖数据", async () => {
  const { root, service, source } = await fixture();
  const before = await source.read("orders");
  expect(before).toMatchObject({
    completeness: "full",
    location: { kind: "remote" },
    writable: true,
  });
  const changes = await Promise.allSettled([
    source.write({ ...before.document, title: "一" }, { ifRevision: before.revision }),
    source.write({ ...before.document, title: "二" }, { ifRevision: before.revision }),
  ]);
  expect(changes.filter((change) => change.status === "fulfilled")).toHaveLength(1);
  expect(
    (changes.find((change) => change.status === "rejected") as PromiseRejectedResult).reason.code,
  ).toBe("REVISION_CONFLICT");
  const current = await source.read("orders");
  await expect(
    source.write({ ...current.document, data: { type: "string" } } as never, {
      ifRevision: current.revision,
    }),
  ).rejects.toMatchObject({ code: "INVALID_MODEL" });
  expect((await source.read("orders")).revision).toBe(current.revision);
  await service.close();
  services.splice(services.indexOf(service), 1);
  const restarted = await fixture(root);
  expect((await restarted.source.read("orders")).revision).toBe(current.revision);
  expect((await restarted.source.list()).map((entry) => entry.id)).toEqual(["cms", "orders"]);
});
it("真实 CRUD 完整更新、嵌套约束与任意记录 id 安全定位", async () => {
  const { request } = await fixture();
  const invalid = await request("/api/records/orders", "POST", {
    orderNo: "bad",
    status: "pending",
    lines: [{ sku: "x", quantity: 0 }],
  });
  expect(invalid.status).toBe(400);
  expect(((await invalid.json()) as any).error.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "/lines/0/quantity", code: "MINIMUM" }),
    ]),
  );
  const value = { id: "../record/a b", orderNo: "NEW", status: "pending", paid: false, amount: 12 };
  const id = encodeURIComponent(value.id);
  expect((await request("/api/records/orders", "POST", value)).status).toBe(201);
  expect((await request("/api/records/orders", "POST", value)).status).toBe(409);
  expect(
    (await request(`/api/records/orders/${id}`, "PUT", { ...value, id: "different" })).status,
  ).toBe(400);
  expect((await request(`/api/records/orders/${id}`, "PUT", { ...value, amount: 42 })).status).toBe(
    200,
  );
  expect(await (await request(`/api/records/orders/${id}`)).json()).toMatchObject({ amount: 42 });
  expect(await (await request(`/api/records/orders/${id}`, "DELETE")).json()).toEqual({
    deleted: true,
  });
  expect((await request(`/api/records/orders/${id}`)).status).toBe(404);
});
it("boolean false 等值、string 包含、分页排序及 loopback 写保护", async () => {
  const { request, origin } = await fixture();
  const query = (filters: unknown, sort?: unknown) =>
    request("/api/records/orders/query", "POST", {
      filters,
      page: 1,
      pageSize: 10,
      ...(sort ? { sort } : {}),
    });
  const falseResult = (await (await query({ paid: false })).json()) as any;
  expect(falseResult.total).toBe(2);
  expect(falseResult.list.every((record: any) => record.paid === false)).toBe(true);
  expect(((await (await query({ orderNo: "002" })).json()) as any).total).toBe(1);
  expect(
    ((await (await query({}, { field: "amount", direction: "desc" })).json()) as any).list.map(
      (record: any) => record.amount,
    ),
  ).toEqual([300, 120, 0]);
  expect((await query({ paid: "false" })).status).toBe(400);
  expect((await query({ lines: [] })).status).toBe(400);
  const cross = await fetch(`${origin}/api/records/orders/query`, {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: JSON.stringify({ filters: {}, page: 1, pageSize: 10 }),
  });
  expect(cross.status).toBe(403);
  expect((await request("/health")).status).toBe(200);
});
