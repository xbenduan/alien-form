import { createHash } from "node:crypto";
import { isObject } from "formwork/model";
import type { CapabilityManifest } from "formwork/model";
import type { FormworkAnalysis } from "./analyze";

/** 将代码分析结果转换为无模型快照的可序列化能力清单。 */
export function createManifest(
  analysis: FormworkAnalysis,
  appId: string,
  clientOrigin: string,
): CapabilityManifest {
  const contents = {
    ...analysis.catalog,
    appId,
    clientOrigin,
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
  if (!response.ok) {
    const lines = [`能力清单登记失败: HTTP ${response.status}`];
    try {
      const payload: unknown = await response.json();
      if (isObject(payload) && isObject(payload.error)) {
        const error = payload.error;
        const text = (value: unknown) => (typeof value === "string" ? value : "");
        lines.push([text(error.code), text(error.message)].filter(Boolean).join(": "));
        if (Array.isArray(error.issues))
          for (const issue of error.issues) {
            if (!isObject(issue)) continue;
            lines.push(
              ["modelId", "router", "path", "code", "message"]
                .map((key) => text(issue[key]))
                .filter(Boolean)
                .join(" · "),
            );
          }
      }
    } catch {
      // Proxies may return non-JSON errors; the HTTP status still identifies the failure.
    }
    const message = lines.filter(Boolean).join("\n");
    throw new Error(token ? message.replaceAll(token, "[secret]") : message);
  }
}
