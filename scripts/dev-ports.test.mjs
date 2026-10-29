import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { selectDevelopmentPort } from "./dev-ports.mjs";

const servers = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function occupyPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  servers.push(server);
  return server.address().port;
}

describe("开发启动端口选择", () => {
  it("默认端口被占用时选择后续可用端口", async () => {
    const occupied = await occupyPort();
    const selected = await selectDevelopmentPort({
      preferred: occupied,
      strict: false,
      label: "client",
    });
    expect(selected).toBeGreaterThan(occupied);
  });

  it("显式端口被占用时保留严格失败语义", async () => {
    const occupied = await occupyPort();
    await expect(
      selectDevelopmentPort({
        preferred: occupied,
        strict: true,
        label: "service",
      }),
    ).rejects.toThrow(`service 端口 ${occupied} 已被占用`);
  });

  it("不会为 client 和 service 选择相同端口", async () => {
    const selected = await selectDevelopmentPort({
      preferred: 55_000,
      strict: false,
      label: "service",
      reserved: new Set([55_000]),
    });
    expect(selected).not.toBe(55_000);
  });
});
