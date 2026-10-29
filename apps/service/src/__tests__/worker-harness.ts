import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createFormworkApi } from "formwork/model";

const wrangler = resolve("apps/service/node_modules/.bin/wrangler");
async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
  return port;
}
async function command(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  const child = spawn(wrangler, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "",
    errors = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    errors += String(chunk);
  });
  return new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? done(output)
        : reject(new Error(`Wrangler ${args[0]} failed (${code}): ${errors}\n${output}`)),
    );
  });
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  await new Promise<void>((done) => {
    child.once("exit", done);
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    timer.unref();
  });
}

/** 启动独立临时 D1 与真实 Wrangler/workerd，退出时回收测试子进程和状态。 */
export async function startWorker(options: { initialSql?: string[]; password?: string } = {}) {
  const root = await mkdtemp(join(tmpdir(), "formwork-worker-"));
  const state = join(root, "state"),
    config = join(root, "wrangler.json");
  const password = options.password ?? randomBytes(24).toString("hex"),
    capabilityToken = randomBytes(32).toString("hex");
  const port = await freePort(),
    origin = `http://127.0.0.1:${port}`;
  const gates = new Map<
    string,
    { ready: Promise<void>; reached: () => void; released: Promise<void>; release: () => void }
  >();
  const gate = (name: string) => {
    if (!gates.has(name)) {
      let reached!: () => void, release!: () => void;
      const ready = new Promise<void>((done) => {
        reached = done;
      });
      const released = new Promise<void>((done) => {
        release = done;
      });
      gates.set(name, { ready, released, reached, release });
    }
    return gates.get(name)!;
  };
  const bridge = createHttpServer((request, response) => {
    const value = gate(decodeURIComponent(request.url!.slice(1)));
    value.reached();
    void value.released.then(() => {
      response.end("released");
    });
  });
  await new Promise<void>((done) => bridge.listen(0, "127.0.0.1", done));
  const bridgeUrl = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
  const closeBridge = async () => {
    for (const value of gates.values()) value.release();
    bridge.closeAllConnections();
    await new Promise<void>((done, reject) =>
      bridge.close((error) => (error ? reject(error) : done())),
    );
  };
  const env = {
    ...process.env,
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_LOG_PATH: join(root, "wrangler.log"),
  };
  let child: ChildProcess | undefined;
  try {
    await writeFile(
      config,
      JSON.stringify({
        name: "formwork-integration",
        main: resolve("apps/service/src/__tests__/worker-entry.ts"),
        compatibility_date: "2026-09-08",
        vars: { FORMWORK_CLIENT_ORIGIN: "http://localhost:5173" },
        d1_databases: [
          {
            binding: "DB",
            database_name: "alien-mdm",
            database_id: "local-test-database",
            migrations_dir: resolve("apps/service/migrations"),
          },
        ],
      }),
    );
    await writeFile(
      join(root, ".dev.vars"),
      [
        "FORMWORK_BOOTSTRAP_ADMIN_USERNAME=integration-admin",
        `FORMWORK_BOOTSTRAP_ADMIN_PASSWORD=${password}`,
        `FORMWORK_CAPABILITY_TOKEN=${capabilityToken}`,
        `FORMWORK_TEST_GATE_URL=${bridgeUrl}`,
      ].join("\n"),
      { mode: 0o600 },
    );
    await command(
      [
        "d1",
        "migrations",
        "apply",
        "alien-mdm",
        "--local",
        "--config",
        config,
        "--persist-to",
        state,
      ],
      env,
    );
    if (options.initialSql?.length) {
      const input = join(root, "import.sql");
      await writeFile(input, options.initialSql.join(";\n") + ";\n", { mode: 0o600 });
      await command(
        [
          "d1",
          "execute",
          "alien-mdm",
          "--local",
          "--config",
          config,
          "--persist-to",
          state,
          "--file",
          input,
        ],
        env,
      );
    }
    child = spawn(
      wrangler,
      [
        "dev",
        "--local",
        "--config",
        config,
        "--persist-to",
        state,
        "--ip",
        "127.0.0.1",
        "--port",
        String(port),
        "--inspector-port",
        "0",
      ],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let logs = "";
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(() => reject(new Error(`Worker startup timeout: ${logs}`)), 30_000);
      const receive = (chunk: Buffer) => {
        logs += String(chunk);
        if (logs.includes("Ready on")) {
          clearTimeout(timer);
          done();
        }
      };
      child!.stdout!.on("data", receive);
      child!.stderr!.on("data", receive);
      child!.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child!.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Worker exited ${code}: ${logs}`));
      });
    });
    const health = await fetch(`${origin}/api/v1/health`);
    if (!health.ok) throw new Error(`Worker bootstrap failed: ${await health.text()}`);
    const api = createFormworkApi({ url: `${origin}/api/v1` });
    const session = await api.auth.login("integration-admin", password);
    const admin = createFormworkApi({ url: `${origin}/api/v1`, token: () => session.token });
    return {
      root,
      origin,
      api: admin,
      token: session.token,
      user: session.user,
      capabilityToken,
      logs: () => logs,
      waitGate: (name: string) => gate(name).ready,
      releaseGate: (name: string) => gate(name).release(),
      async sql(sql: string) {
        const output = await command(
          [
            "d1",
            "execute",
            "alien-mdm",
            "--local",
            "--config",
            config,
            "--persist-to",
            state,
            "--command",
            sql,
            "--json",
          ],
          env,
        );
        return JSON.parse(output) as Array<{ results: Record<string, unknown>[] }>;
      },
      request(
        path: string,
        method = "GET",
        body?: unknown,
        token = session.token,
        headers: Record<string, string> = {},
      ) {
        return fetch(`${origin}/api/v1${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      },
      async close() {
        await stop(child!);
        await closeBridge();
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (child) await stop(child);
    await closeBridge();
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
