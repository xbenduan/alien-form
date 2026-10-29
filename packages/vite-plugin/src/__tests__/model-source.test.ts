import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { ModelDocument } from "formwork/model";
import { assertSnapshot } from "formwork/model";
import { createFileModelSource } from "../model-source";
import { createSourceMiddleware } from "../source-http";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const model = (id = "orders"): ModelDocument => ({
  id,
  title: "订单",
  data: { type: "object", properties: { title: { type: "string" } } },
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "formwork-source-"));
  directories.push(root);
  await mkdir(join(root, "src/models/orders"), { recursive: true });
  await writeFile(join(root, "src/models/orders/model.json"), JSON.stringify(model()));
  return { root, source: createFileModelSource({ root, models: ["src/models/**/model.json"] }) };
}

describe("文件源公开行为", () => {
  it("read/list 完整且排序，原始格式变更产生新 revision", async () => {
    const { root, source } = await fixture();
    const first = await source.read("orders");
    expect(first).toMatchObject({
      completeness: "full",
      location: { kind: "local", path: "src/models/orders/model.json" },
      document: model(),
    });
    await writeFile(join(root, "src/models/orders/model.json"), JSON.stringify(model(), null, 2));
    expect((await source.read("orders")).revision).not.toBe(first.revision);
    await source.write(model("cms"), { ifRevision: null });
    expect((await source.list()).map((entry) => entry.id)).toEqual(["cms", "orders"]);
    expect(await readFile(join(root, "src/models/cms/model.json"), "utf8")).toContain(
      '"id": "cms"',
    );
  });
  it("相同 revision 的并发更新仅允许一次，失败保留原文", async () => {
    const { root, source } = await fixture();
    const first = await source.read("orders");
    const results = await Promise.allSettled([
      source.write({ ...model(), title: "one" }, { ifRevision: first.revision }),
      source.write({ ...model(), title: "two" }, { ifRevision: first.revision }),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(
      (results.find((item) => item.status === "rejected") as PromiseRejectedResult).reason.code,
    ).toBe("REVISION_CONFLICT");
    const saved = await readFile(join(root, "src/models/orders/model.json"), "utf8");
    await expect(
      source.write({ ...model(), data: { type: "array" } } as never, {
        ifRevision: first.revision,
      }),
    ).rejects.toMatchObject({ code: "INVALID_MODEL" });
    expect(await readFile(join(root, "src/models/orders/model.json"), "utf8")).toBe(saved);
    const signal = AbortSignal.abort();
    await expect(source.write(model("new"), { ifRevision: null, signal })).rejects.toMatchObject({
      code: "ABORTED",
    });
  });
  it("拒绝重复 id、外部 symlink 与损坏 JSON，不返回旧 snapshot", async () => {
    const { root, source } = await fixture();
    await mkdir(join(root, "src/models/duplicate"));
    await writeFile(join(root, "src/models/duplicate/model.json"), JSON.stringify(model()));
    await expect(source.list()).rejects.toMatchObject({ code: "INVALID_MODEL" });
    await rm(join(root, "src/models/duplicate"), { recursive: true });
    await writeFile(join(root, "src/models/orders/model.json"), "{invalid");
    await expect(source.read("orders")).rejects.toMatchObject({ code: "INVALID_MODEL" });
    const outside = await mkdtemp(join(tmpdir(), "formwork-outside-"));
    directories.push(outside);
    await writeFile(join(outside, "model.json"), JSON.stringify(model("external")));
    await rm(join(root, "src/models/orders"), { recursive: true });
    await symlink(outside, join(root, "src/models/orders"));
    await expect(source.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("真实 HTTP 复用文件 CAS，拒绝跨源写和任意路径", async () => {
    const { source } = await fixture();
    const middleware = createSourceMiddleware(source);
    const server = createServer((request, response) => {
      void middleware(request, response).then((handled) => {
        if (!handled) {
          response.statusCode = 404;
          response.end();
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const first = assertSnapshot(
        await (await fetch(`${origin}/__formwork/models/orders`)).json(),
      );
      const put = (title: string, headers: Record<string, string> = { "x-formwork-tool": "1" }) =>
        fetch(`${origin}/__formwork/models/orders`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ document: { ...model(), title }, ifRevision: first.revision }),
        });
      expect((await put("cross", { origin: "https://evil.example" })).status).toBe(403);
      const responses = await Promise.all([put("browser", { origin }), put("mcp")]);
      expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
      expect(
        assertSnapshot(await (await fetch(`${origin}/__formwork/models/orders`)).json())
          .completeness,
      ).toBe("full");
      expect((await fetch(`${origin}/__formwork/models/%2E%2E%2Fsecret`)).status).toBe(400);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
