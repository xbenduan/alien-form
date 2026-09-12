#!/usr/bin/env node
/**
 * alien-form 本地开发启动器（跨平台，Windows / macOS / Linux 通用）
 *
 * 用法：
 *   pnpm dev:local
 *
 * 它做三件事：
 *   1. 检查 packages/{core,engine,protocol,react} 的 dist 是否落后于 src，落后才重建；
 *   2. 应用本地 D1 迁移（幂等）；
 *   3. 并行启动 worker（:8787）与 web（:5173），日志带 [worker] / [web] 前缀。
 *
 * 为什么不用 package.json 里原来的 `pnpm dev`：
 *   apps/alien-worker 的 dev 脚本用了 `VAR=x cmd` 这种 bash 风格环境变量前缀，
 *   而 pnpm 在 Windows 默认用 cmd.exe 执行脚本，会直接报
 *   「'XDG_CONFIG_HOME' 不是内部或外部命令」。
 *
 * 为什么不用 `bash scripts/dev-windows.sh`：
 *   Git for Windows 只把 `C:\Program Files\Git\cmd` 加进 PATH，而 bash.exe 位于
 *   `C:\Program Files\Git\bin` —— 不在 PATH 上。因此从 PowerShell / Windows Terminal
 *   运行时会找不到 bash。Node 则必然可用，且 spawn 不走 shell，天然规避
 *   MSYS 路径转换（本机设了 MSYS_NO_PATHCONV=1）与 shell 垫片的双重坑。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";

const WORKER_DIR = path.join(ROOT, "apps", "alien-worker");
const WEB_DIR = path.join(ROOT, "apps", "alien-mdm");

const WRANGLER_ENTRY = path.join(WORKER_DIR, "node_modules", "wrangler", "bin", "wrangler.js");
const VITE_ENTRY = path.join(WEB_DIR, "node_modules", "vite", "bin", "vite.js");
const WRANGLER_CONFIG = path.join(ROOT, "wrangler.json");

const LOG_DIR = path.join(ROOT, ".wrangler", "logs");

// 有 src 且有 build 脚本的工作区包。builder / shared 是纯产物包，无需重建。
const BUILDABLE_PKGS = ["core", "engine", "protocol", "react"];

/** wrangler 需要的隔离环境：把全局配置与日志都收进仓库内的 .wrangler。 */
function wranglerEnv(logFile) {
  return {
    ...process.env,
    XDG_CONFIG_HOME: path.join(ROOT, ".wrangler", "config-home"),
    WRANGLER_LOG_PATH: path.join(LOG_DIR, logFile),
  };
}

function runSync(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.error) {
    console.error(`执行失败: ${cmd} ${args.join(" ")}\n${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
}

/** 目录下最新的文件 mtime（毫秒）。 */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestMtime(full));
    else newest = Math.max(newest, statSync(full).mtimeMs);
  }
  return newest;
}

/** dist 比 src 旧（或 dist 不存在）的包。 */
function stalePackages() {
  const stale = [];
  for (const name of BUILDABLE_PKGS) {
    const srcDir = path.join(ROOT, "packages", name, "src");
    const distEntry = path.join(ROOT, "packages", name, "dist", "index.js");
    if (!existsSync(srcDir)) continue;
    if (!existsSync(distEntry) || newestMtime(srcDir) > statSync(distEntry).mtimeMs) {
      stale.push(name);
    }
  }
  return stale;
}

/** 给子进程输出加前缀，按行切分。 */
function prefixOutput(label, stream, sink) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) sink.write(`${label} ${line}\n`);
  });
  stream.on("end", () => {
    if (buffer) sink.write(`${label} ${buffer}\n`);
  });
}

const children = [];
let shuttingDown = false;

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (IS_WIN) {
      // wrangler 会派生子进程（workerd），需要连同子树一起结束。
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* 尽力而为 */
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child);
  setTimeout(() => process.exit(code), 400);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function startServer(name, label, entry, args, cwd, env) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  prefixOutput(label, child.stdout, process.stdout);
  prefixOutput(label, child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n[${name}] 进程已退出（code=${code}），正在停止其余服务…`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

// ---------------------------------------------------------------- 主流程

if (!existsSync(WRANGLER_ENTRY) || !existsSync(VITE_ENTRY)) {
  console.error("缺少依赖，请先在仓库根目录执行： pnpm install");
  process.exit(1);
}

const stale = stalePackages();
if (stale.length > 0) {
  console.log(`==> 工作区包产物过期：${stale.join(", ")} —— 正在重建`);
  // pnpm 在 Windows 上是 .cmd，必须经 shell 启动。
  const filters = stale.flatMap((n) => ["--filter", `@alien-form/${n}`]);
  runSync("pnpm", [...filters, "run", "build"], { cwd: ROOT, shell: IS_WIN });
}

console.log("==> 应用本地 D1 迁移");
runSync(
  process.execPath,
  [WRANGLER_ENTRY, "d1", "migrations", "apply", "alien-mdm", "--local", "--config", WRANGLER_CONFIG],
  { cwd: WORKER_DIR, env: wranglerEnv("migrate-local.log") },
);

console.log("\n==> 启动服务（Ctrl+C 停止）");
console.log("    web    -> http://localhost:5173   (开发用，带 HMR)");
console.log("    worker -> http://127.0.0.1:8787\n");

startServer(
  "worker",
  "[worker]",
  WRANGLER_ENTRY,
  ["dev", "--config", WRANGLER_CONFIG],
  WORKER_DIR,
  wranglerEnv("dev.log"),
);

startServer("web", "[web]   ", VITE_ENTRY, [], WEB_DIR, process.env);
