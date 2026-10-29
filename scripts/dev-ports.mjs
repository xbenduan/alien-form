import { createServer } from "node:net";

function canListen(port, reserved) {
  if (reserved.has(port)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * 选择 loopback 开发端口，显式端口冲突时报错，默认端口冲突时向后查找。
 * @param options reserved 用于避免 client 与 service 在同一次启动中选择相同端口。
 * @returns 最终可监听的端口；探测完成后会立即释放。
 * @example await selectDevelopmentPort({ preferred: 5173, strict: false, label: "client" })
 */
export async function selectDevelopmentPort({ preferred, strict, label, reserved = new Set() }) {
  if (await canListen(preferred, reserved)) return preferred;
  if (strict) throw new Error(`${label} 端口 ${preferred} 已被占用`);
  for (let candidate = preferred + 1; candidate <= 65_535; candidate++) {
    if (await canListen(candidate, reserved)) return candidate;
  }
  throw new Error(`找不到可用的 ${label} 端口（从 ${preferred} 开始）`);
}
