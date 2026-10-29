import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
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
const document = {
  id: "orders",
  title: "订单",
  data: { type: "object", properties: { title: { type: "string" } } },
};
async function fixture(entry?: string) {
  const root = await mkdtemp(join(tmpdir(), "formwork-plugin-"));
  roots.push(root);
  await mkdir(join(root, "src/models/orders"), { recursive: true });
  await symlink(resolve("apps/client/node_modules"), join(root, "node_modules"));
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(join(root, "src/models/orders/model.json"), JSON.stringify(document));
  await writeFile(
    join(root, "src/model.schema.ts"),
    `import {modelDocumentSchema} from "formwork/model";/** 要求原文标题不使用 forbidden。 */export const schema=modelDocumentSchema.refine(document=>document.title!=="forbidden",{path:["title"],message:"forbidden title"});`,
  );
  await writeFile(
    join(root, "src/ui.tsx"),
    `/** 读取当前字段。 */export const Input=(props: {value?: string})=><input value={props.value}/>;export const ObjectFields=(props)=>props.children;/** 返回示例。 */export function quote(ctx: unknown, amount: number){throw new Error("fn must not execute");}`,
  );
  await writeFile(
    join(root, "src/domain.tsx"),
    `import {defineDomain} from "formwork";import {schema} from "./model.schema";import {Input} from "./ui";export default defineDomain({schema,components:{Input}});`,
  );
  await writeFile(
    join(root, "src/pages.tsx"),
    `import {definePage} from "formwork";export const unused=definePage({router:unknownRouter});export const home=definePage({router:"home",render:<><div>Home</div></>});export const models=definePage({router:"models",path:"/models/:domain?",render:()=>null});`,
  );
  await writeFile(join(root, "src/reexport.ts"), `export {home,models} from "./pages";`);
  await writeFile(
    join(root, "src/formwork.tsx"),
    entry ??
      `import {defineFormwork,definePage,defineWindow} from "formwork";import {home,models} from "./reexport";import {Input,ObjectFields} from "./ui";import * as fn from "./ui";const extras=[home,models];const domains={orders:()=>import("./domain")};const list=definePage({router:"list",path:"/list/:domain",domains});const edit=defineWindow({router:"edit",path:"/edit/:domain/:id",presentation:"modal",returnTo:"list",domains});const common={components:{Input,Object:ObjectFields},fn};export default defineFormwork({...common,pages:[...extras,list],windows:[edit]});`,
  );
  const server = await createServer({
    root,
    configFile: false,
    plugins: [
      formworkPlugin({ entry: "src/formwork.tsx", models: ["src/models/**/model.json"] }),
      solid(),
    ],
    resolve: { conditions: ["solid", "browser"] },
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  servers.push(server);
  await server.listen();
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
  const tool = async (name: string, input: unknown) => {
    const response = await fetch(`${origin}/__formwork/tools/${name}`, {
      method: "POST",
      headers: { "x-formwork-tool": "1" },
      body: JSON.stringify(input),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  return { root, server, origin, tool };
}
describe("实际 Vite 工具契约", () => {
  it("可达 const/spread/re-export/namespace/动态 Domain 提取声明且不执行 UI/fn", async () => {
    const { tool, server } = await fixture();
    const result = await tool("formwork.capabilities", { modelId: "orders", router: "list" });
    expect(result.status).toBe(200);
    expect(result.body.components.find((item: any) => item.name === "Input")).toMatchObject({
      declaration: expect.stringContaining("value?: string"),
      jsDoc: expect.stringContaining("读取当前字段"),
      overrides: expect.any(Array),
    });
    expect(result.body.fn.find((item: any) => item.name === "quote").declaration).toContain(
      "amount: number",
    );
    expect((await tool("models.list", {})).body).toHaveLength(1);
    const transformed = await server.transformRequest("/src/pages.tsx");
    expect(transformed?.code).toMatch(/render:\s*\(\)\s*=>/u);
    const map = transformed?.map;
    expect(map && "sources" in map && map.sources).toContain("pages.tsx");
    const virtual = (await server.ssrLoadModule("virtual:formwork/capabilities")).default;
    expect(virtual.capabilities("orders", "list").components).toContainEqual(
      expect.objectContaining({ name: "Input", overrides: expect.any(Array) }),
    );
    expect(virtual.capabilities("new_model", "list").fn).toContainEqual(
      expect.objectContaining({ name: "quote", jsDoc: expect.stringContaining("返回示例") }),
    );
    expect(() => virtual.capabilities("orders", "missing")).toThrow("未知 router");
  });
  it("六工具共享完整源、就近 Zod、CAS 与实际预览参数", async () => {
    const { tool, origin } = await fixture();
    const before = (await tool("models.read", { modelId: "orders" })).body;
    const invalid = { ...document, title: "forbidden" };
    expect(
      (await tool("models.validate", { modelId: "orders", document: invalid })).body.errors[0],
    ).toMatchObject({ path: "/title", router: "list" });
    expect(
      (
        await tool("models.write", {
          modelId: "orders",
          document: invalid,
          ifRevision: before.revision,
        })
      ).status,
    ).toBe(400);
    const saved = await tool("models.write", {
      modelId: "orders",
      document: { ...document, title: "更新" },
      ifRevision: before.revision,
    });
    expect(saved.status).toBe(200);
    expect(
      (await tool("models.write", { modelId: "orders", document, ifRevision: before.revision }))
        .status,
    ).toBe(409);
    expect(
      (await tool("models.preview", { modelId: "orders", router: "edit" })).body.error.code,
    ).toBe("PARAMS_REQUIRED");
    const preview = (
      await tool("models.preview", { modelId: "orders", router: "edit", params: { id: "a/b" } })
    ).body;
    expect(preview.url).toContain("/models/orders?");
    expect(preview.url).toContain("id=a%2Fb");
    const browser = await fetch(`${origin}/__formwork/models/orders`);
    expect(await browser.json()).toMatchObject({
      revision: saved.body.revision,
      completeness: "full",
      document: { title: "更新" },
    });
    const scoped = { ...document, views: { card: { component: "LocalCard", field: "/itemName" } } };
    const scopedReport = (
      await tool("models.validate", { modelId: "orders", document: scoped, router: "list" })
    ).body;
    expect(scopedReport.errors).toEqual([]);
    expect(scopedReport.runtimeChecks).toContainEqual(
      expect.objectContaining({ path: "/views/card", code: "RUNTIME_VIEW" }),
    );
    const invalidView = { ...document, views: { list: { component: "Input", field: "/missing" } } };
    expect(
      (await tool("models.validate", { modelId: "orders", document: invalidView, router: "list" }))
        .body.errors,
    ).toContainEqual(expect.objectContaining({ path: "/views/list/field", code: "UNKNOWN_FIELD" }));
  });
  it("未知 router/动态定义/不安全 schema 明确诊断", async () => {
    const { tool, root } = await fixture();
    expect(
      (await tool("formwork.capabilities", { modelId: "orders", router: "missing" })).body.error
        .code,
    ).toBe("UNKNOWN_ROUTER");
    await writeFile(
      join(root, "src/model.schema.ts"),
      `import {modelDocumentSchema} from "formwork/model";export const schema=modelDocumentSchema.refine(()=>!!window.document);`,
    );
    await expect
      .poll(
        async () =>
          (await tool("models.validate", { modelId: "orders", document })).body.error?.code,
      )
      .toBe("TOOL_CONTRACT");
  });
  it("不可确定的 router 与重复路径在真实构建阶段失败", async () => {
    await expect(
      fixture(
        `import {defineFormwork,definePage} from "formwork";const router=readRouter();export default defineFormwork({pages:[definePage({router})]});`,
      ),
    ).rejects.toThrow("静态常量");
    await expect(
      fixture(
        `import {defineFormwork,definePage} from "formwork";export default defineFormwork({pages:[definePage({router:"one",path:"/a/:id"}),definePage({router:"two",path:"/a/:other"})]});`,
      ),
    ).rejects.toThrow("路径歧义");
  });
  it("生产 virtual 经真实 Vite 打包后可在 Node 读取完整只读快照", async () => {
    const { root } = await fixture();
    await writeFile(
      join(root, "source.ts"),
      'export {default} from "virtual:formwork/models";export {default as capabilities} from "virtual:formwork/capabilities";',
    );
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        formworkPlugin({ entry: "src/formwork.tsx", models: ["src/models/**/model.json"] }),
      ],
      build: {
        lib: { entry: join(root, "source.ts"), formats: ["es"], fileName: () => "source.mjs" },
        rolldownOptions: { external: ["formwork/model"] },
      },
    });
    const output = await import(pathToFileURL(join(root, "dist/source.mjs")).href);
    const source = output.default;
    expect(output.capabilities.capabilities("orders", "list").components).toContainEqual(
      expect.objectContaining({
        name: "Input",
        declaration: expect.any(String),
        overrides: expect.any(Array),
      }),
    );
    await writeFile(
      join(root, "src/models/orders/model.json"),
      JSON.stringify({ ...document, title: "构建后变更" }),
    );
    expect(await source.list()).toMatchObject([{ id: "orders", title: "订单", writable: false }]);
    const snapshot = await source.read("orders");
    expect(snapshot).toMatchObject({ completeness: "full", writable: false, document });
    snapshot.document.title = "改动读取值";
    expect((await source.read("orders")).document.title).toBe("订单");
    await expect(source.write(document, { ifRevision: snapshot.revision })).rejects.toMatchObject({
      code: "READ_ONLY",
    });
  });
  it("拒绝将带模型写入口的开发服务器监听到外部地址", async () => {
    await expect(
      createServer({
        configFile: false,
        server: { host: "0.0.0.0" },
        plugins: [
          formworkPlugin({ entry: "src/formwork.tsx", models: ["src/models/**/model.json"] }),
        ],
      }),
    ).rejects.toThrow("loopback");
  });
});
