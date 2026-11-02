import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "vite";
import { startLocalWorker } from "../apps/service/script/local-worker.mjs";
import { selectDevelopmentPort } from "./dev-ports.mjs";
import {
  bindingKey,
  createTableSql,
  literal,
  quote,
} from "../apps/service/src/adapters/d1/compiler/storage";
import { modelDefinitionSchema } from "formwork/model";
import type { RecordValue } from "formwork/model";
import type { StorageManifest } from "../apps/service/src/contracts";

const repository = resolve(import.meta.dirname, "..");
const root = process.env.FORMWORK_E2E_ROOT;
if (!root) throw new Error("FORMWORK_E2E_ROOT 必须由 Playwright 配置提供");
await mkdir(root, { recursive: true });
const password = randomBytes(24).toString("hex");
const username = "e2e-admin";
const capabilityToken = randomBytes(32).toString("hex");
await writeFile(join(root, "login.json"), JSON.stringify({ username, password }), { mode: 0o600 });
const initialSql: string[] = [];
for (const id of ["orders", "cms"]) {
  const definition = modelDefinitionSchema.parse(
    JSON.parse(await readFile(resolve(repository, `examples/${id}.definition.json`), "utf8")),
  );
  const manifest: StorageManifest = {
    table: definition.backend.storage.table,
    bindings: definition.backend.storage.bindings.map((binding) => ({ ...binding, active: true })),
    relations: [],
  };
  const now = new Date().toISOString();
  initialSql.push(
    createTableSql(manifest.table, manifest.bindings),
    `INSERT INTO fw_models(id,creator_id,active_version,management_revision,storage_table,created_at,updated_at)
     VALUES (${literal(id)},'e2e-fixture',1,${literal(crypto.randomUUID())},${literal(manifest.table)},${literal(now)},${literal(now)})`,
    `INSERT INTO fw_model_versions(model_id,version,definition_json,storage_manifest_json,publish_revision,published_by,published_at)
     VALUES (${literal(id)},1,${literal(JSON.stringify(definition))},${literal(JSON.stringify(manifest))},${literal(crypto.randomUUID())},'e2e-fixture',${literal(now)})`,
  );
  const records = JSON.parse(
    await readFile(resolve(repository, `examples/${id}.records.json`), "utf8"),
  ) as RecordValue[];
  for (const record of records) {
    const row: Record<string, string | number | null> = {
      id: String(record.id),
      created_at: now,
      updated_at: now,
      creator_id: "e2e-fixture",
      data_content: JSON.stringify(record),
    };
    for (const binding of manifest.bindings) {
      if (!binding.column || Object.hasOwn(row, binding.column)) continue;
      const value = record[bindingKey(binding)];
      row[binding.column] =
        value == null
          ? null
          : binding.encoding === "json"
            ? JSON.stringify(value)
            : typeof value === "boolean"
              ? Number(value)
              : (value as string | number);
    }
    initialSql.push(
      `INSERT INTO ${quote(manifest.table)} (${Object.keys(row).map(quote).join(",")})
       VALUES (${Object.values(row)
         .map((value) =>
           value === null ? "NULL" : typeof value === "number" ? String(value) : literal(value),
         )
         .join(",")})`,
    );
  }
}
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
  initialSql,
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
