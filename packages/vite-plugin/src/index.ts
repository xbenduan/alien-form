import type { Plugin } from "vite";
import { resolve } from "node:path";
import { analyzeFormwork } from "./analyze";
import type { FormworkAnalysis } from "./analyze";
import { createManifest, registerManifest } from "./manifest";
import { transformRender } from "./transform";
import { capabilitiesVirtualModule } from "./virtual";

/** 配置代码入口及仅在 Vite server 使用的能力清单登记凭证。 */
export type FormworkPluginOptions = {
  entry: string;
  appId?: string;
  capabilities?: {
    apiUrl: string;
    token: () => string | undefined;
    clientOrigin?: string;
  };
};
/**
 * 分析可达代码、转换 JSX 并生成能力清单。
 * @param options entry 相对 Vite root；capabilities.token 仅在开发服务进程读取。
 * @example formworkPlugin({ entry: "src/formwork.tsx", appId: "alien-form" })
 */
export function formworkPlugin(options: FormworkPluginOptions): Plugin {
  let root = "";
  let analysis: FormworkAnalysis;
  let server: import("vite").ViteDevServer | undefined;
  let resolver: (id: string, importer: string) => Promise<string | undefined>;
  let analyzing: Promise<void> | undefined;
  let dirty = true;
  let changes = 0;
  const ensureAnalysis = async () => {
    if (!dirty) return;
    if (analyzing) return analyzing;
    const turn = changes;
    analyzing = (async () => {
      analysis = await analyzeFormwork(root, options.entry, resolver);
      dirty = turn !== changes;
    })();
    try {
      await analyzing;
    } finally {
      analyzing = undefined;
    }
    if (dirty) await ensureAnalysis();
  };
  const register = async () => {
    if (!options.capabilities || !server) return;
    const token = options.capabilities.token();
    if (!token) throw new Error("能力清单登记缺少 FORMWORK_CAPABILITY_TOKEN");
    await ensureAnalysis();
    const origin =
      options.capabilities.clientOrigin ?? server.resolvedUrls?.local[0]?.replace(/\/$/u, "");
    if (!origin) return;
    await registerManifest(
      options.capabilities.apiUrl,
      token,
      createManifest(analysis, options.appId ?? "alien-form", origin),
    );
    server.config.logger.info("Formwork 能力清单已登记");
  };
  const reportRegistration = () => {
    void register().catch((error: unknown) =>
      server?.config.logger.error(error instanceof Error ? error.message : "能力清单登记失败"),
    );
  };
  return {
    name: "formwork",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      resolver = async (id, importer) => (await this.resolve(id, importer, { skipSelf: true }))?.id;
      await ensureAnalysis();
      for (const file of analysis.files) this.addWatchFile(file);
    },
    resolveId(id) {
      if (id === "virtual:formwork/capabilities") return `\0${id}`;
    },
    async load(id) {
      if (id === "\0virtual:formwork/capabilities") {
        await ensureAnalysis();
        return capabilitiesVirtualModule(analysis);
      }
    },
    async transform(code, id) {
      if (!/\.[cm]?[jt]sx?(?:\?|$)/u.test(id) || id.includes("node_modules")) return null;
      await ensureAnalysis();
      return transformRender(code, id, analysis.transforms.get(id.split("?")[0]!) ?? []);
    },
    configureServer(vite) {
      server = vite;
      resolver = async (id, importer) =>
        (await vite.environments.client.pluginContainer.resolveId(id, importer))?.id;
      vite.httpServer?.once("listening", reportRegistration);
    },
    async handleHotUpdate(context) {
      if (!analysis.files.has(context.file) && context.file !== resolve(root, options.entry))
        return;
      changes++;
      dirty = true;
      await ensureAnalysis();
      const module = context.server.environments.client.moduleGraph.getModuleById(
        "\0virtual:formwork/capabilities",
      );
      if (module) context.server.environments.client.moduleGraph.invalidateModule(module);
      reportRegistration();
    },
    async generateBundle() {
      await ensureAnalysis();
      const manifest = createManifest(
        analysis,
        options.appId ?? "alien-form",
        options.capabilities?.clientOrigin ?? "",
      );
      this.emitFile({
        type: "asset",
        fileName: "formwork-capabilities.json",
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
