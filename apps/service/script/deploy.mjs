import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean" },
    outdir: { type: "string" },
    env: { type: "string" },
    config: { type: "string", default: resolve(import.meta.dirname, "../wrangler.json") },
  },
});
const common = ["--config", values.config, ...(values.env ? ["--env", values.env] : [])];
const wrangler = resolve(import.meta.dirname, "../node_modules/wrangler/bin/wrangler.js");
async function run(entry, args) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? done() : reject(new Error(`部署命令失败 (${code})`)),
    );
  });
}
if (!values["dry-run"])
  await run(resolve(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"), [
    resolve(import.meta.dirname, "initialize.ts"),
    "--remote",
    ...common,
  ]);
await run(wrangler, [
  "deploy",
  ...common,
  ...(values["dry-run"] ? ["--dry-run"] : []),
  ...(values.outdir ? ["--outdir", values.outdir] : []),
]);
if (!values["dry-run"]) {
  const secrets = Object.fromEntries(
    [
      "FORMWORK_BOOTSTRAP_ADMIN_USERNAME",
      "FORMWORK_BOOTSTRAP_ADMIN_PASSWORD",
      "FORMWORK_CAPABILITY_TOKEN",
    ].flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  );
  if (Object.keys(secrets).length) {
    const directory = await mkdtemp(join(tmpdir(), "alien-form-secrets-"));
    try {
      const file = join(directory, "secrets.json");
      await writeFile(file, JSON.stringify(secrets), { mode: 0o600 });
      await run(wrangler, ["secret", "bulk", file, ...common]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
