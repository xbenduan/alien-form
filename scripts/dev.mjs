#!/usr/bin/env node
/** 构建 Formwork 包并启动独立 client/service；退出时回收本启动器的进程树。 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const isWindows = process.platform === "win32";
const clientPort = process.env.FORMWORK_CLIENT_PORT ?? "5173";
const servicePort = process.env.FORMWORK_SERVICE_PORT ?? "8788";
const vite = resolve(root, "apps/client/node_modules/vite/bin/vite.js");
const tsx = resolve(root, "apps/service/node_modules/tsx/dist/cli.mjs");
if (!existsSync(vite) || !existsSync(tsx)) {
  console.error("缺少依赖，请先运行 pnpm install。");
  process.exit(1);
}
for (const port of [clientPort, servicePort]) {
  if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    console.error("FORMWORK_CLIENT_PORT / FORMWORK_SERVICE_PORT 必须为 1–65535。");
    process.exit(1);
  }
}
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
let stopping = false;
function shutdown(code) {
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
  process.exitCode = code;
}
function start(label, directory, entry, args) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: resolve(root, directory),
    env: process.env,
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  for (const [stream, sink] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) sink.write(`[${label}] ${line}\n`);
    });
    stream.on("end", () => {
      if (pending) sink.write(`[${label}] ${pending}\n`);
    });
  }
  child.on("error", (error) => {
    console.error(`[${label}] ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!stopping) shutdown(code ?? 1);
  });
}
process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
start("service", "apps/service", tsx, ["src/main.ts"]);
start("client", "apps/client", vite, ["--host", "127.0.0.1", "--port", clientPort, "--strictPort"]);
console.log(`Client: http://127.0.0.1:${clientPort} · Service: http://127.0.0.1:${servicePort}`);
