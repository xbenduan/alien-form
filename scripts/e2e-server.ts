import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { createDevelopmentService } from "../apps/service/src/app";
import { seedDevelopment } from "../apps/service/src/seed";

const root = process.env.FORMWORK_E2E_ROOT;
if (!root) throw new Error("FORMWORK_E2E_ROOT 必须由 Playwright 配置提供");
await mkdir(root, { recursive: true });
const service = createDevelopmentService(join(root, "data"));
await seedDevelopment(service, [resolve("apps/client/src/models/orders/model.json"), resolve("apps/client/src/domains/cms/model.json")]);
await service.listen(8788);
const servers: ViteDevServer[] = [];
for (const [name, port] of [["local", 5184], ["remote", 5186]] as const) {
  const appRoot = join(root, name);
  await mkdir(appRoot, { recursive: true });
  await cp(resolve("apps/client/src"), join(appRoot, "src"), { recursive: true });
  await cp(resolve("apps/client/index.html"), join(appRoot, "index.html"));
  await writeFile(join(appRoot, "package.json"), '{"type":"module"}');
  await writeFile(join(appRoot, "tsconfig.json"), '{"compilerOptions":{"jsx":"preserve","jsxImportSource":"solid-js"}}');
  await symlink(resolve("apps/client/node_modules"), join(appRoot, "node_modules"));
  const server = await createServer({
    root: appRoot, configFile: resolve("apps/client/vite.config.ts"),
    define: { "import.meta.env.VITE_MODEL_SOURCE": JSON.stringify(name) },
    server: { host: "127.0.0.1", port, strictPort: true },
  });
  await server.listen(); servers.push(server);
}
console.log("Formwork E2E local :5184 / remote :5186 ready");
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  if (stopping) return; stopping = true;
  void Promise.all(servers.map((server) => server.close())).then(() => service.close()).then(() => rm(root, { recursive: true, force: true })).then(() => { process.exitCode = 0; });
});
