import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createServer } from "vite";
import solid from "vite-plugin-solid";
import type { ViteDevServer } from "vite";
import { formworkPlugin } from "../index";
import { analyzeFormwork } from "../analyze";

const roots: string[] = [];
const servers: ViteDevServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(entry?: string) {
  const root = await mkdtemp(join(tmpdir(), "formwork-plugin-"));
  roots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await symlink(resolve("apps/client/node_modules"), join(root, "node_modules"));
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(
    join(root, "src/ui.tsx"),
    `/** 读取当前字段。 */export const Input=(props: {value?: string})=><input value={props.value}/>;
     export const ObjectFields=(props)=>props.children;
     export const ui={types:{string:{form:{component:"Input"}}}};
     export const formats={richtext:{schema:()=>{throw new Error("FUNCTION_BODY_SENTINEL")}}};`,
  );
  await writeFile(
    join(root, "src/domain.tsx"),
    `import {defineDomain} from "formwork";
     export default defineDomain({router:"list",render:()=>null,transformSchema:(ctx)=>ctx});`,
  );
  await writeFile(
    join(root, "src/pages.tsx"),
    `import {definePage} from "formwork";
     export const unused=definePage({router:unknownRouter});
     export const home=definePage({router:"home",render:()=> <div>Home</div>});
     export const models=definePage({router:"models",render:()=>null});`,
  );
  await writeFile(join(root, "src/reexport.ts"), `export {home,models} from "./pages";`);
  await writeFile(
    join(root, "src/formwork.tsx"),
    entry ??
      `import {defineFormwork,defineDomain} from "formwork";
     import {home,models} from "./reexport";import * as fields from "./ui";
     import {ui,formats} from "./ui";import list from "./domain";
     const extras=[home,models];const components={Input:fields.Input,Object:fields.ObjectFields};
     export default defineFormwork({apis:{},components,ui,formats,domains:[list,defineDomain({router:"tree-list",render:()=>null})],pages:[...extras]});`,
  );
  const server = await createServer({
    root,
    configFile: false,
    plugins: [formworkPlugin({ entry: "src/formwork.tsx" }), solid()],
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { conditions: ["solid", "browser"] },
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  servers.push(server);
  await server.listen();
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
  await server.transformRequest("/src/pages.tsx");
  return { root, server, origin };
}
describe("可选 Vite 静态清单", () => {
  it("默认 CMS 可独立分析，业务 Domain 不覆盖 app 组件", async () => {
    const root = resolve("apps/client");
    const server = await createServer({
      root,
      configFile: false,
      server: { middlewareMode: true },
    });
    servers.push(server);
    const analysis = await analyzeFormwork(
      root,
      "src/formwork/index.ts",
      async (id, importer) =>
        (await server.environments.client.pluginContainer.resolveId(id, importer))?.id,
    );
    expect(Object.keys(analysis.catalog.domains)).toEqual(["list", "tree-list", "videos"]);
    expect(analysis.catalog.pages).toContain("model-preview");
    expect(analysis.catalog.app.components.map((item) => item.name)).toContain("ListTable");
    expect(analysis.catalog.app.formats.map((item) => item.name)).toContain("richtext");
  });
  it("追踪 const、spread、re-export 和 namespace，不执行应用函数", async () => {
    const { server } = await fixture();
    const virtual = (await server.ssrLoadModule("virtual:formwork/capabilities")).default;
    const capabilities = virtual.capabilities(
      { id: "orders", domain: "arbitrary-business" },
      { router: "list" },
    );
    expect(
      capabilities.components.find((item: { name: string }) => item.name === "Input"),
    ).toMatchObject({
      declaration: expect.stringContaining("value?: string"),
      jsDoc: expect.stringContaining("读取当前字段"),
    });
    expect(capabilities.domainTransform).toBeTruthy();
    expect(
      virtual.capabilities({ id: "orders", domain: "list" }, { router: "tree-list" })
        .domainTransform,
    ).toBeUndefined();
    expect(virtual.routes).toEqual([
      { router: "list", path: "/list/:modelId", model: true },
      { router: "tree-list", path: "/tree-list/:modelId", model: true },
      { router: "home", path: "/home", model: false },
      { router: "models", path: "/models", model: false },
    ]);
    expect(() => virtual.capabilities({ id: "orders" }, { router: "missing" })).toThrow(
      "已登记的 Domain",
    );
    expect(JSON.stringify(capabilities)).not.toContain("FUNCTION_BODY_SENTINEL");
    expect(capabilities.ui.declaration).toContain("component");
  });
  it("开发服务不增加模型文件或工具端点", async () => {
    const { origin } = await fixture();
    expect((await fetch(`${origin}/__formwork/models/orders`)).status).toBe(404);
    expect(
      (
        await fetch(`${origin}/__formwork/tools/models.read`, {
          method: "POST",
          body: JSON.stringify({ modelId: "orders" }),
        })
      ).status,
    ).toBe(404);
  });
  it("拒绝动态 router、跨注册表重名、直接 JSX 和未显式装配", async () => {
    const app = (rest: string) => `import {defineFormwork,defineDomain,definePage} from "formwork";
      export default defineFormwork({apis:{},ui:{},components:{},${rest}});`;
    await expect(
      fixture(app("domains:[],pages:[definePage({router:readRouter(),render:()=>null})]")),
    ).rejects.toThrow("静态常量");
    await expect(
      fixture(
        app(
          'domains:[defineDomain({router:"list",render:()=>null})],pages:[definePage({router:"list",render:()=>null})]',
        ),
      ),
    ).rejects.toThrow("重复 router");
    await expect(
      fixture(app('domains:[],pages:[definePage({router:"home",render:<div/>})]')),
    ).rejects.toThrow("render 必须是函数");
    await expect(fixture(app("pages:[]"))).rejects.toThrow("显式注册 domains");
  });
  it("生产构建只登记声明，不包含函数体、模型快照或 credential", async () => {
    const { root, server } = await fixture();
    await server.close();
    await writeFile(
      join(root, "source.ts"),
      'export {default} from "virtual:formwork/capabilities";',
    );
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        formworkPlugin({
          entry: "src/formwork.tsx",
          capabilities: {
            apiUrl: "https://worker.example/api/v1",
            token: () => "DEPLOY_TOKEN_SENTINEL",
            clientOrigin: "https://client.example",
          },
        }),
      ],
      build: {
        lib: { entry: join(root, "source.ts"), formats: ["es"], fileName: () => "source.mjs" },
        rolldownOptions: { external: ["formwork/model"] },
      },
    });
    const output = await import(pathToFileURL(join(root, "dist/source.mjs")).href);
    expect(
      output.default.capabilities({ id: "orders" }, { router: "list" }).components,
    ).toContainEqual(expect.objectContaining({ name: "Input" }));
    const manifest = JSON.parse(
      await readFile(join(root, "dist/formwork-capabilities.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      appId: "alien-form",
      formatVersion: 1,
      clientOrigin: "https://client.example",
      revision: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(manifest.domains.list.transformSchema).toBeTruthy();
    expect(manifest.pages).toEqual(["home", "models"]);
    for (const file of await readdir(join(root, "dist"))) {
      const text = await readFile(join(root, "dist", file), "utf8");
      expect(text).not.toContain("FUNCTION_BODY_SENTINEL");
      expect(text).not.toContain("DEPLOY_TOKEN_SENTINEL");
    }
  });
});
