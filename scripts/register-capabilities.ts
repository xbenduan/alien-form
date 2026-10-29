import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { URL } from "node:url";
import type { CapabilityManifest } from "formwork/model";

const { values } = parseArgs({
  options: {
    "api-url": { type: "string" },
    "client-origin": { type: "string" },
    file: { type: "string", default: "apps/client/dist/formwork-capabilities.json" },
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
const { revision: _revision, ...contents } = JSON.parse(
  await readFile(values.file, "utf8"),
) as CapabilityManifest;
contents.clientOrigin = origin.origin;
const revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
const manifest = { ...contents, revision };
const response = await fetch(
  `${api.href.replace(/\/$/u, "")}/formwork/capabilities/${encodeURIComponent(manifest.appId)}`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ revision, manifest, origin: origin.origin }),
    signal: AbortSignal.timeout(15_000),
  },
);
if (!response.ok) throw new Error(`清单登记失败 HTTP ${response.status}: ${await response.text()}`);
console.log(JSON.stringify({ appId: manifest.appId, revision, registered: true }));
