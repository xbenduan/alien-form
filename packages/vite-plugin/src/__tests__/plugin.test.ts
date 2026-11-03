import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createServer } from "vite";
import solid from "vite-plugin-solid";
import type { ViteDevServer } from "vite";
import { formworkPlugin } from "../index";

const roots: string[] = [];
const servers: ViteDevServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(entry?: string) {
  const root = await mkdtemp(join(tmpdir(), "formwork-plugin-"));
  roots.push(root);
  await mkdir(join(root, "src/models/orders"), { recursive: true });
  await symlink(resolve("apps/client/node_modules"), join(root, "node_modules"));
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  // 迁移输入可以是坏 JSON；插件不再把文件模型当事实来源。
  await writeFile(join(root, "src/models/orders/model.json"), '{"private":"MODEL_FILE_SENTINEL"');
  await writeFile(
    join(root, "src/model.schema.ts"),
    `import {modelDocumentSchema} from "formwork/model";/** 只在浏览器执行。 */export const schema=modelDocumentSchema.refine(()=>!!window.document);`,
  );
  await writeFile(
    join(root, "src/ui.tsx"),
    `/** 读取当前字段。 */export const Input=(props: {value?: string})=><input value={props.value}/>;export const ObjectFields=(props)=>props.children;/** 返回示例。 */export function quote(ctx: unknown, amount: number){throw new Error("FUNCTION_BODY_SENTINEL");}`,
  );
  await writeFile(
    join(root, "src/domain.tsx"),
    `import {defineDomain} from "formwork";import {schema} from "./model.schema";import {Input} from "./ui";export default defineDomain({modelSchema:schema,components:{Input},transformSchema:(ctx)=>ctx.schema});`,
  );
  await writeFile(
    join(root, "src/pages.tsx"),
    `import {definePage} from "formwork";export const unused=definePage({router:unknownRouter});export const home=definePage({router:"home",render:<><div>Home</div></>});export const models=definePage({router:"models",path:"/models/:domain?",render:()=>null});`,
  );
  await writeFile(join(root, "src/reexport.ts"), `export {home,models} from "./pages";`);
  await writeFile(
    join(root, "src/formwork.tsx"),
    entry ??
      `import {defineFormwork,definePage,defineWindow} from "formwork";import {home,models} from "./reexport";import {Input,ObjectFields} from "./ui";import * as fn from "./ui";const extras=[home,models];const domains={orders:()=>import("./domain")};const load=(ctx)=>ctx.api.runtime.schema(ctx.modelId).then(s=>s.schema);const edit=defineWindow({path:"edit/:id",openMode:"modal",container:()=>null,getValue:(ctx)=>ctx.initialValue});const windows={edit};const list=definePage({router:"list",getSchema:load,container:()=>null,windows});const tree=definePage({router:"tree-list",getSchema:load,container:()=>null,windows});const common={components:{Input,Object:ObjectFields},fn};export default defineFormwork({...common,domains,pages:[...extras,list,tree],presenters:{page:()=>null,modal:()=>null}});`,
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
  // 实际 transform 触发 buildStart，不执行 UI 模块。
  await server.transformRequest("/src/pages.tsx");
  return { root, server, origin };
}
describe("Vite 代码清单与 JSX 契约", () => {
  it("可达 const/spread/re-export/namespace/动态 Domain 保留声明和覆盖，不执行 UI/fn", async () => {
    const { server } = await fixture();
    const transformed = await server.transformRequest("/src/pages.tsx");
    expect(transformed?.code).toMatch(/render:\s*\(\)\s*=>/u);
    const map = transformed?.map;
    expect(map && "sources" in map && map.sources).toContain("pages.tsx");
    const virtual = (await server.ssrLoadModule("virtual:formwork/capabilities")).default;
    const capabilities = virtual.capabilities({ id: "orders" }, { router: "list" });
    expect(
      capabilities.components.find((item: { name: string }) => item.name === "Input"),
    ).toMatchObject({
      declaration: expect.stringContaining("value?: string"),
      jsDoc: expect.stringContaining("读取当前字段"),
      overrides: expect.any(Array),
    });
    expect(
      capabilities.fn.find((item: { name: string }) => item.name === "quote").declaration,
    ).toContain("amount: number");
    expect(capabilities.pageLoader).toBeTruthy();
    expect(capabilities.domainTransform).toBeTruthy();
    expect(
      virtual.capabilities({ id: "new-model" }, { router: "list" }).domainTransform,
    ).toBeUndefined();
    expect(
      virtual.capabilities(
        { id: "articles", domain: "orders" },
        { router: "tree-list", window: "edit" },
      ).valueLoader,
    ).toBeTruthy();
    expect(() =>
      virtual.capabilities({ id: "articles", domain: "missing" }, { router: "list" }),
    ).toThrow("Domain 未注册");
    expect(() => virtual.capabilities({ id: "orders" }, { router: "missing" })).toThrow(
      "未知 Page",
    );
    expect(JSON.stringify(capabilities)).not.toContain("FUNCTION_BODY_SENTINEL");
  });
  it("开发服务没有文件模型和工具端点", async () => {
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
  it("应用 loader/Domain 与 Page loader 的有效能力保持一致", async () => {
    const { server } = await fixture(
      `import {defineFormwork,definePage} from "formwork";
       import {Input,ObjectFields} from "./ui";
       const appLoader=(ctx)=>ctx.api.runtime.schema(ctx.modelId).then(s=>s.schema);
       const localLoader=(ctx)=>ctx.api.runtime.schema(ctx.modelId).then(s=>s.schema);
       export default defineFormwork({
         getSchema:appLoader,
         domains:{orders:()=>import("./domain")},
         components:{Input,Object:ObjectFields},
         pages:[definePage({router:"list",container:()=>null}),definePage({router:"tree-list",container:()=>null,getSchema:localLoader})],
         presenters:{page:()=>null}
       });`,
    );
    const virtual = (await server.ssrLoadModule("virtual:formwork/capabilities")).default;
    const list = virtual.capabilities({ id: "orders" }, { router: "list" });
    const tree = virtual.capabilities({ id: "orders" }, { router: "tree-list" });
    expect(list.pageLoader.declaration).toContain("appLoader");
    expect(tree.pageLoader.declaration).toContain("localLoader");
    expect(list.domainTransform).toBeTruthy();
    expect(list.modelContract).toContain("data:fieldMap");
    expect(virtual.routes).toContainEqual({ router: "list", path: "/list/:modelId", model: true });
  });
  it("动态 router、重复路径和缺少 Page loader 在实际分析阶段失败", async () => {
    await expect(
      fixture(
        `import {defineFormwork,definePage} from "formwork";const router=readRouter();export default defineFormwork({pages:[definePage({router,render:()=>null})],presenters:{page:()=>null}});`,
      ),
    ).rejects.toThrow("静态常量");
    await expect(
      fixture(
        `import {defineFormwork,definePage} from "formwork";export default defineFormwork({pages:[definePage({router:"one",path:"/a/:id",render:()=>null}),definePage({router:"two",path:"/a/:other",render:()=>null})],presenters:{page:()=>null}});`,
      ),
    ).rejects.toThrow("路径歧义");
    await expect(
      fixture(
        `import {defineFormwork,definePage} from "formwork";export default defineFormwork({pages:[definePage({router:"list",container:()=>null})],presenters:{page:()=>null}});`,
      ),
    ).rejects.toThrow("getSchema");
  });
  it("生产构建 emit 无模型的 manifest，声明不含执行体或 deploy credential", async () => {
    const { root, server } = await fixture();
    // 生产构建不与同目录的 dev watcher/依赖预构建并行。
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
    ).toContainEqual(expect.objectContaining({ name: "Input", overrides: expect.any(Array) }));
    const manifestText = await readFile(join(root, "dist/formwork-capabilities.json"), "utf8");
    const manifest = JSON.parse(manifestText);
    expect(manifest).toMatchObject({
      appId: "alien-form",
      formatVersion: 2,
      clientOrigin: "https://client.example",
      revision: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(manifest.pages.list.capabilities.getSchema).toBeTruthy();
    expect(manifest.domains.orders.transformSchema).toBeTruthy();
    expect(manifest.pages.list.windows.edit.path).toBe("/list/:modelId/edit/:id");
    expect(manifest.pages["tree-list"].windows.edit.path).toBe("/tree-list/:modelId/edit/:id");
    const files = await readdir(join(root, "dist"));
    const contents = await Promise.all(
      files.map((file) => readFile(join(root, "dist", file), "utf8")),
    );
    for (const text of contents) {
      expect(text).not.toContain("MODEL_FILE_SENTINEL");
      expect(text).not.toContain("FUNCTION_BODY_SENTINEL");
      expect(text).not.toContain("DEPLOY_TOKEN_SENTINEL");
    }
  });
});
