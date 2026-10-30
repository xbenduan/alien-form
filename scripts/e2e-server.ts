import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "vite";
import { startLocalWorker } from "./local-worker.mjs";
import { selectDevelopmentPort } from "./dev-ports.mjs";
import { planMigration } from "../apps/service/src/migration/convert";
import type { ModelDocument } from "formwork/model";

const root = process.env.FORMWORK_E2E_ROOT;
if (!root) throw new Error("FORMWORK_E2E_ROOT 必须由 Playwright 配置提供");
await mkdir(root, { recursive: true });
const password = randomBytes(24).toString("hex");
const username = "e2e-admin";
const capabilityToken = randomBytes(32).toString("hex");
await writeFile(join(root, "login.json"), JSON.stringify({ username, password }), { mode: 0o600 });
const documents = await Promise.all(
  ["orders", "cms"].map(
    async (id) =>
      JSON.parse(
        await readFile(resolve(`apps/service/src/migration/fixtures/${id}.document.json`), "utf8"),
      ) as ModelDocument,
  ),
);
const plan = await planMigration({
  models: [],
  tables: [],
  files: documents.map((document) => ({
    document,
    published: true,
    records:
      document.id === "orders"
        ? [
            {
              id: "order-1",
              orderNo: "SO-2026-001",
              status: "pending",
              paid: false,
              amount: 120,
              lines: [],
            },
            {
              id: "order-2",
              orderNo: "SO-2026-002",
              status: "paid",
              paid: true,
              amount: 240,
              lines: [],
            },
            {
              id: "order-3",
              orderNo: "SO-2026-003",
              status: "pending",
              paid: false,
              amount: 360,
              lines: [],
            },
          ]
        : [{ id: "article-1", title: "首篇内容", content: "初始正文" }],
  })),
});
if (plan.errors.length) throw new Error(JSON.stringify(plan.errors));
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
  initialSql: plan.statements,
  detached: false,
});
const server = await createServer({
  root: resolve("apps/client"),
  configFile: resolve("apps/client/vite.config.ts"),
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
