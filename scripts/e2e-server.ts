import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "vite";
import { startLocalWorker } from "../apps/service/script/local-worker.mjs";
import { selectDevelopmentPort } from "./dev-ports.mjs";

const repository = resolve(import.meta.dirname, "..");
const root = process.env.FORMWORK_E2E_ROOT;
if (!root) throw new Error("FORMWORK_E2E_ROOT 必须由 Playwright 配置提供");
await mkdir(root, { recursive: true });
const password = randomBytes(24).toString("hex");
const username = "e2e-admin";
const capabilityToken = randomBytes(32).toString("hex");
await writeFile(join(root, "login.json"), JSON.stringify({ username, password }), { mode: 0o600 });
const servicePort = await selectDevelopmentPort({
  preferred: 8789,
  label: "E2E Worker",
  strict: false,
});
process.env.FORMWORK_SERVICE_PORT = String(servicePort);
process.env.FORMWORK_CAPABILITY_TOKEN = capabilityToken;
process.env.FORMWORK_CLIENT_ORIGIN = "http://127.0.0.1:5184";
const worker = await startLocalWorker({
  directory: root,
  port: servicePort,
  clientOrigin: process.env.FORMWORK_CLIENT_ORIGIN,
  username,
  password,
  capabilityToken,
  detached: false,
});
const server = await createServer({
  root: resolve(repository, "apps/client"),
  configFile: resolve(repository, "apps/client/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5184, strictPort: true },
});
await server.listen();
console.log(`Formwork E2E Vite :5184 / Worker D1 :${servicePort} ready`);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    void Promise.all([worker.close(), server.close()])
      .then(() => rm(root, { recursive: true, force: true }))
      .then(() => {
        process.exitCode = 0;
      });
  });
