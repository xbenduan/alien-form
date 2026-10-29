import type { Plugin } from "vite";
import { matchesGlob, relative, resolve } from "node:path";
import { FormworkError } from "formwork/model";
import { createModelTools } from "formwork/mcp";
import type { ModelToolName } from "formwork/mcp";
import { analyzeFormwork } from "./analyze";
import type { FormworkAnalysis } from "./analyze";
import { createFileModelSource } from "./model-source";
import { createSourceMiddleware, guardRequest, readJson, sendError, sendJson } from "./source-http";
import { transformRender } from "./transform";
import { createValidatorLoader } from "./validators";
import { capabilitiesVirtualModule, modelVirtualModule } from "./virtual";

/** 配置应用入口与允许的完整模型文件模式。 */
export type FormworkPluginOptions = { entry: string; models: readonly string[] };

/**
 * 在 Solid 编译前接入 Formwork 的模型与定义处理。
 * @param options entry 与 models 相对 Vite root；首个 glob 的静态根同时作为新模型创建目录。
 * @example formworkPlugin({ entry: "src/formwork.tsx", models: ["src/models/" + "**" + "/model.json"] })
 */
export function formworkPlugin(options: FormworkPluginOptions): Plugin {
  let root = "";
  let development = false;
  let analysis: FormworkAnalysis;
  let validator: ReturnType<typeof createValidatorLoader>;
  let source: ReturnType<typeof createFileModelSource>;
  let tools: ReturnType<typeof createModelTools>;
  let server: import("vite").ViteDevServer | undefined;
  let resolver: (id: string, importer: string) => Promise<string | undefined>;
  let analyzing: Promise<void> | undefined;
  let dirty = true;
  const isModelFile = (file: string) =>
    options.models.some((pattern) =>
      matchesGlob(relative(root, file).replaceAll("\\", "/"), pattern),
    );
  const notifyModelUpdate = async (file: string) => {
    if (!isModelFile(file)) return;
    try {
      const entries = await source.list();
      const entry = entries.find(
        (value) => value.location.kind === "local" && resolve(root, value.location.path) === file,
      );
      if (entry) {
        await ensureAnalysis();
        const report = await tools.validate(entry.id, (await source.read(entry.id)).document);
        if (report.errors.length)
          throw new FormworkError("INVALID_MODEL", "模型 HMR 校验失败", report.errors);
      }
      server?.ws.send({
        type: "custom",
        event: "formwork:model-update",
        data: { modelId: entry?.id, revision: entry?.revision },
      });
    } catch (error) {
      server?.ws.send({
        type: "custom",
        event: "formwork:model-update",
        data: { error: String(error) },
      });
      server?.config.logger.error(String(error));
    }
  };
  const ensureAnalysis = async () => {
    if (!dirty) return;
    if (analyzing) return analyzing;
    analyzing = (async () => {
      const next = await analyzeFormwork(root, options.entry, resolver);
      if (validator) await validator.dispose();
      analysis = next;
      validator = createValidatorLoader(analysis, resolver);
      tools = createModelTools({
        source,
        routes: analysis.routes,
        schemaRouters: analysis.schemaRouters,
        capabilities: analysis.capabilities,
        validate: validator.validate,
        origin: server?.resolvedUrls?.local[0]?.replace(/\/$/u, ""),
      });
      dirty = false;
    })();
    try {
      await analyzing;
    } finally {
      analyzing = undefined;
    }
  };
  return {
    name: "formwork",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      development = config.command === "serve";
      if (
        development &&
        ![undefined, false, "localhost", "127.0.0.1", "::1", "[::1]"].includes(config.server.host)
      ) {
        throw new FormworkError("FORBIDDEN", "Formwork 开发服务只能监听 loopback 地址");
      }
      source = createFileModelSource({
        root,
        models: options.models,
        async validate(document) {
          await ensureAnalysis();
          const report = await tools.validate(document.id, document);
          if (report.errors.length)
            throw new FormworkError("INVALID_MODEL", "有效模型校验失败", report.errors);
        },
        onUpdate(snapshot) {
          server?.ws.send({
            type: "custom",
            event: "formwork:model-update",
            data: { modelId: snapshot.id, revision: snapshot.revision },
          });
        },
      });
    },
    async buildStart() {
      resolver = async (id, importer) => (await this.resolve(id, importer, { skipSelf: true }))?.id;
      await ensureAnalysis();
      for (const file of analysis.files) this.addWatchFile(file);
      for (const entry of await source.list()) {
        const snapshot = await source.read(entry.id);
        const report = await tools.validate(entry.id, snapshot.document);
        if (report.errors.length) this.error(JSON.stringify(report.errors));
        if (entry.location.kind === "local") this.addWatchFile(resolve(root, entry.location.path));
      }
    },
    resolveId(id) {
      if (["virtual:formwork/models", "virtual:formwork/capabilities"].includes(id))
        return `\0${id}`;
    },
    async load(id) {
      if (id === "\0virtual:formwork/models") {
        await ensureAnalysis();
        const snapshots = development
          ? []
          : await Promise.all((await source.list()).map((entry) => source.read(entry.id)));
        return modelVirtualModule(development, snapshots);
      }
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
      const onDirectoryUpdate = (file: string) => {
        void notifyModelUpdate(file);
      };
      vite.watcher.on("add", onDirectoryUpdate);
      vite.watcher.on("unlink", onDirectoryUpdate);
      vite.httpServer?.once("close", () => {
        vite.watcher.off("add", onDirectoryUpdate);
        vite.watcher.off("unlink", onDirectoryUpdate);
      });
      const middleware = createSourceMiddleware(source);
      vite.middlewares.use((request, response, next) => {
        void (async () => {
          const url = new URL(request.url ?? "/", "http://127.0.0.1");
          if (url.pathname.startsWith("/__formwork/tools/")) {
            const controller = new AbortController();
            request.once("aborted", () => controller.abort());
            try {
              guardRequest(request, true);
              if (request.method !== "POST")
                throw new FormworkError("NOT_FOUND", "工具仅接受 POST");
              await ensureAnalysis();
              const name = decodeURIComponent(
                url.pathname.slice("/__formwork/tools/".length),
              ) as ModelToolName;
              sendJson(
                response,
                200,
                await tools.call(
                  name,
                  await readJson(request, controller.signal),
                  controller.signal,
                ),
              );
            } catch (error) {
              sendError(response, error);
            }
          } else if (!(await middleware(request, response))) next();
        })().catch(next);
      });
    },
    async handleHotUpdate(context) {
      if (isModelFile(context.file)) {
        await notifyModelUpdate(context.file);
        return [];
      }
      if (validator?.files.has(context.file) || context.file === resolve(root, options.entry)) {
        dirty = true;
        const module = context.server.moduleGraph.getModuleById("\0virtual:formwork/capabilities");
        if (module) context.server.moduleGraph.invalidateModule(module);
      }
    },
    async closeBundle() {
      if (validator) await validator.dispose();
    },
  };
}
