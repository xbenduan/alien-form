#!/usr/bin/env node
/** 构建共享包并启动 Vite 与本地 Worker/D1；退出时回收自身进程树。 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { selectDevelopmentPort } from "./dev-ports.mjs";
import { startLocalWorker } from "./local-worker.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const isWindows = process.platform === "win32";
const requestedClientPort = process.env.FORMWORK_CLIENT_PORT ?? "5173";
const requestedServicePort = process.env.FORMWORK_SERVICE_PORT ?? "8788";
const vite = resolve(root, "apps/client/node_modules/vite/bin/vite.js");
const wrangler = resolve(root, "apps/service/node_modules/wrangler/bin/wrangler.js");
if (!existsSync(vite) || !existsSync(wrangler)) {
  console.error("缺少依赖，请先运行 pnpm install。");
  process.exit(1);
}
for (const port of [requestedClientPort, requestedServicePort]) {
  if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    console.error("FORMWORK_CLIENT_PORT / FORMWORK_SERVICE_PORT 必须为 1–65535。");
    process.exit(1);
  }
}
let clientPort;
let servicePort;
try {
  clientPort = await selectDevelopmentPort({
    preferred: Number(requestedClientPort),
    strict: process.env.FORMWORK_CLIENT_PORT !== undefined,
    label: "client",
  });
  servicePort = await selectDevelopmentPort({
    preferred: Number(requestedServicePort),
    strict: process.env.FORMWORK_SERVICE_PORT !== undefined,
    label: "service",
    reserved: new Set([clientPort]),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
if (clientPort !== Number(requestedClientPort))
  console.log(`Client 端口 ${requestedClientPort} 已占用，改用 ${clientPort}。`);
if (servicePort !== Number(requestedServicePort))
  console.log(`Service 端口 ${requestedServicePort} 已占用，改用 ${servicePort}。`);
const childEnv = {
  ...process.env,
  FORMWORK_CLIENT_PORT: String(clientPort),
  FORMWORK_SERVICE_PORT: String(servicePort),
};
const directory =
  process.env.FORMWORK_DATA_DIR ??
  join(
    homedir(),
    ".local/share/alien-form/development",
    createHash("sha256").update(root).digest("hex").slice(0, 16),
  );
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const credentialFile = join(directory, "bootstrap.json");
try {
  await writeFile(
    credentialFile,
    JSON.stringify(
      {
        username: `dev-${randomBytes(6).toString("hex")}`,
        password: randomBytes(24).toString("hex"),
        capabilityToken: randomBytes(32).toString("hex"),
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
await chmod(credentialFile, 0o600);
const credentials = JSON.parse(await readFile(credentialFile, "utf8"));
childEnv.FORMWORK_CAPABILITY_TOKEN = credentials.capabilityToken;
childEnv.FORMWORK_CLIENT_ORIGIN = `http://127.0.0.1:${clientPort}`;
for (const name of ["formwork", "formwork-vite-plugin"]) {
  const args = ["--filter", name, "build"];
  const options = { cwd: root, stdio: "inherit" };
  const pnpmEntry = process.env.npm_execpath;
  // pnpm 12 的未替换 native launcher 没有 shebang，需要 sh 的执行回退。
  const result = pnpmEntry
    ? /\.[cm]?js$/u.test(pnpmEntry)
      ? spawnSync(process.execPath, [pnpmEntry, ...args], options)
      : spawnSync(pnpmEntry, args, options)
    : isWindows
      ? spawnSync("pnpm.cmd", args, { ...options, shell: true })
      : spawnSync("/bin/sh", ["-c", 'exec pnpm "$@"', "formwork-dev", ...args], options);
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}

const children = [];
let worker;
let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    try {
      if (isWindows)
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") console.error(error.message);
    }
  }
  await worker?.close();
  process.exitCode = code;
}
function start(label, directory, entry, args) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: resolve(root, directory),
    env: childEnv,
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let ready, failed;
  const started = new Promise((done, reject) => {
    ready = done;
    failed = reject;
  });
  const timer = setTimeout(
    () => failed(new Error("Vite 能力清单登记超时，请检查 Worker 和 deploy credential。")),
    30_000,
  );
  for (const [stream, sink] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        sink.write(`[${label}] ${line}\n`);
        if (line.includes("Formwork 能力清单已登记")) {
          clearTimeout(timer);
          ready();
        }
        if (line.includes("能力清单登记失败") || line.includes("能力清单登记缺少")) {
          clearTimeout(timer);
          failed(new Error(line));
        }
      }
    });
    stream.on("end", () => {
      if (pending) sink.write(`[${label}] ${pending}\n`);
    });
  }
  child.on("error", (error) => {
    clearTimeout(timer);
    failed(error);
    console.error(`[${label}] ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    clearTimeout(timer);
    failed(new Error(`Vite 启动退出 (${code})`));
    if (!stopping) shutdown(code ?? 1);
  });
  return started;
}
process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
try {
  worker = await startLocalWorker({
    directory,
    port: servicePort,
    clientOrigin: childEnv.FORMWORK_CLIENT_ORIGIN,
    ...credentials,
  });
  worker.child.once("exit", (code) => {
    if (!stopping) void shutdown(code ?? 1);
  });
  const { createFormworkApi } = await import("formwork/model");
  const session = await createFormworkApi({ url: `${worker.origin}/api/v1` }).auth.login(
    credentials.username,
    credentials.password,
  );
  const api = createFormworkApi({ url: `${worker.origin}/api/v1`, token: () => session.token });
  if (stopping) {
    await worker.close();
    process.exit(0);
  }
  await start("client", "apps/client", vite, [
    "--host",
    "127.0.0.1",
    "--port",
    clientPort,
    "--strictPort",
  ]);
  const existing = new Set((await api.models.list()).map((entry) => entry.id));
  for (const id of ["orders", "cms"]) {
    if (existing.has(id)) continue;
    const document = JSON.parse(
      await readFile(
        resolve(root, `apps/service/src/migration/fixtures/${id}.document.json`),
        "utf8",
      ),
    );
    const bindings = Object.entries(document.data.properties).map(([key, node]) => ({
      id: `${id}:${key}`,
      path: `/${key}`,
      column: key,
      sqlType: ["boolean", "integer"].includes(node.type)
        ? "INTEGER"
        : node.type === "number"
          ? "REAL"
          : "TEXT",
      encoding: ["array", "object"].includes(node.type) ? "json" : "scalar",
    }));
    await api.models.saveDraft(
      id,
      {
        document,
        backend: {
          storage: { table: `biz_${id}`, bindings },
          relations: [],
          permissions: { grants: [], privateFields: [] },
          behavior: { rules: [], commands: {}, events: {} },
        },
      },
      { ifRevision: null },
    );
  }
  await api.auth.logout();
  if (stopping) await worker.close();
  else {
    console.log(`Client: ${childEnv.FORMWORK_CLIENT_ORIGIN} · Worker: ${worker.origin}`);
    console.log(
      `本地 D1: ${directory}；登录账号与密码保存在 ${credentialFile}（权限 0600）。首次示例为草稿，请在管理页手动发布。`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
