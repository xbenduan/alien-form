import { createHash } from "node:crypto";
import type { CapabilityManifest } from "formwork/model";
import type { FormworkAnalysis } from "./analyze";

/** 将代码分析结果转换为无模型快照的可序列化能力清单。 */
export function createManifest(
  analysis: FormworkAnalysis,
  appId: string,
  clientOrigin: string,
): CapabilityManifest {
  const forRouter = (id: string) =>
    Object.fromEntries(
      analysis.routes.map(({ router }) => [router, analysis.capabilities(id, router)]),
    );
  const contents = {
    appId,
    clientOrigin,
    routes: analysis.routes,
    schemaRouters: analysis.schemaRouters,
    defaultCapabilities: forRouter(""),
    domainCapabilities: Object.fromEntries(analysis.domainIds.map((id) => [id, forRouter(id)])),
  };
  const revision = createHash("sha256").update(JSON.stringify(contents)).digest("hex");
  return { ...contents, revision };
}

/** 用仅服务端可见的 deploy credential 向 Worker 登记清单。 */
export async function registerManifest(
  apiUrl: string,
  token: string,
  manifest: CapabilityManifest,
): Promise<void> {
  const response = await fetch(
    `${apiUrl.replace(/\/$/u, "")}/formwork/capabilities/${encodeURIComponent(manifest.appId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        revision: manifest.revision,
        manifest,
        origin: manifest.clientOrigin,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`能力清单登记失败: HTTP ${response.status}`);
}
