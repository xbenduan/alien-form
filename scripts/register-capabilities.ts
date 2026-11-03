import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createServer } from "vite";
import type { CapabilityManifest } from "formwork/model";
import { analyzeFormwork } from "../packages/vite-plugin/src/analyze";
import { registerManifest } from "../packages/vite-plugin/src/manifest";

const { values } = parseArgs({
  options: {
    "api-url": { type: "string" },
    "client-origin": { type: "string" },
    file: { type: "string" },
  },
});
const token = process.env.FORMWORK_CAPABILITY_TOKEN;
if (!token || !values["api-url"] || !values["client-origin"]) {
  throw new Error(
    "需要 --api-url、--client-origin 和环境变量 FORMWORK_CAPABILITY_TOKEN（deploy 身份）",
  );
}
const origin = new URL(values["client-origin"]);
if (origin.origin !== values["client-origin"])
  throw new Error("client-origin 必须是没有路径的 HTTP(S) origin");
const api = new URL(values["api-url"]);
if (!["http:", "https:"].includes(api.protocol)) throw new Error("api-url 必须是 HTTP(S) URL");
async function contentsFromApp(): Promise<Omit<CapabilityManifest, "revision">> {
  const root = resolve(import.meta.dirname, "../apps/client");
  const server = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true },
  });
  try {
    const analysis = await analyzeFormwork(
      root,
      "src/formwork/index.ts",
      async (id, importer) =>
        (await server.environments.client.pluginContainer.resolveId(id, importer))?.id,
    );
    return { ...analysis.catalog, appId: "alien-form", clientOrigin: origin.origin };
  } finally {
    await server.close();
  }
}
const contents = values.file
  ? (({ revision: _revision, ...rest }: CapabilityManifest) => rest)(
      JSON.parse(await readFile(values.file, "utf8")),
    )
  : await contentsFromApp();
contents.clientOrigin = origin.origin;
const revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
const manifest = { ...contents, revision };
await registerManifest(api.href, token, manifest);
console.log(JSON.stringify({ appId: manifest.appId, revision, registered: true }));
