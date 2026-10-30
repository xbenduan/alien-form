import { spawn } from "node:child_process";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const wrangler = resolve(repository, "apps/service/node_modules/wrangler/bin/wrangler.js");

async function stop(child, detached) {
  if (child.exitCode !== null || !child.pid) return;
  await new Promise((done) => {
    const timer = setTimeout(() => {
      try {
        if (detached) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {}
    }, 5000);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      done();
    });
    try {
      if (detached) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      done();
    }
  });
}

/**
 * 启动生产入口的本地 Worker 和独立 D1，凭证只写入私有目录。
 * @param {object} options
 * @param {string} options.directory 本次 D1、配置与 secret 的目录。
 * @param {number} options.port
 * @param {string} options.clientOrigin 客户端地址；本地回环域名同时允许相同协议和端口的 localhost/127.0.0.1。
 * @param {string} options.username
 * @param {string} options.password
 * @param {string} options.capabilityToken
 * @param {string[]} [options.initialSql] 仅用于导入隔离测试数据库的已发布基线。
 * @param {boolean} [options.detached] 开发进程独立回收；E2E 设为 false 以继承 Playwright 进程组。
 * @returns 就绪的 API 地址、仅本地 SQL 执行器和进程回收函数。
 */
export async function startLocalWorker(options) {
  const { directory, port, clientOrigin, username, password, capabilityToken } = options;
  const allowedOrigins = new Set([clientOrigin]);
  const clientUrl = new URL(clientOrigin);
  if (clientUrl.hostname === "localhost" || clientUrl.hostname === "127.0.0.1") {
    clientUrl.hostname = clientUrl.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowedOrigins.add(clientUrl.origin);
  }
  const detached = options.detached ?? true;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const config = join(directory, "wrangler.json");
  const state = join(directory, "state");
  const env = {
    ...process.env,
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_LOG_PATH: join(directory, "wrangler.log"),
  };
  const redact = (value) =>
    [password, capabilityToken].reduce(
      (text, secret) => text.replaceAll(secret, "[secret]"),
      value,
    );
  await writeFile(
    config,
    JSON.stringify({
      name: "formwork-local",
      main: resolve(repository, "apps/service/src/index.ts"),
      compatibility_date: "2026-09-08",
      vars: { FORMWORK_CLIENT_ORIGIN: [...allowedOrigins].join(",") },
      d1_databases: [
        {
          binding: "DB",
          database_name: "alien-mdm",
          database_id: "formwork-local-database",
          migrations_dir: resolve(repository, "apps/service/migrations"),
        },
      ],
    }),
  );
  const secrets = join(directory, ".dev.vars");
  await writeFile(
    secrets,
    [
      `FORMWORK_BOOTSTRAP_ADMIN_USERNAME=${username}`,
      `FORMWORK_BOOTSTRAP_ADMIN_PASSWORD=${password}`,
      `FORMWORK_CAPABILITY_TOKEN=${capabilityToken}`,
    ].join("\n"),
    { mode: 0o600 },
  );
  await chmod(secrets, 0o600);
  const common = ["--local", "--config", config, "--persist-to", state];
  const command = async (args) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: repository,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? done() : reject(new Error(redact(`Wrangler ${args[0]} (${code}): ${output}`))),
      );
    });
    return output;
  };
  await command(["d1", "migrations", "apply", "alien-mdm", ...common]);
  if (options.initialSql?.length) {
    const file = join(directory, "baseline.sql");
    await writeFile(file, `${options.initialSql.join(";\n")};\n`, { mode: 0o600 });
    await command(["d1", "execute", "alien-mdm", ...common, "--file", file]);
  }
  const child = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      ...common,
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
    ],
    { cwd: repository, env, detached, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  try {
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error(redact(`Worker 启动超时: ${logs}`))), 30_000);
      const receive = (chunk) => {
        logs = (logs + String(chunk)).slice(-30_000);
        if (logs.includes("Ready on")) {
          clearTimeout(timer);
          done();
        }
      };
      child.stdout.on("data", receive);
      child.stderr.on("data", receive);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(redact(`Worker 退出 (${code}): ${logs}`)));
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const health = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(15_000) });
    if (!health.ok) throw new Error(`Worker 初始化失败: ${redact(await health.text())}`);
    return {
      origin,
      child,
      sql: (sql) => command(["d1", "execute", "alien-mdm", ...common, "--command", sql, "--json"]),
      close: () => stop(child, detached),
    };
  } catch (error) {
    await stop(child, detached);
    throw error;
  }
}
