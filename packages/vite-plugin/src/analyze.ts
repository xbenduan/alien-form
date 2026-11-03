import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { FormworkError, createRoutes, manifestCapabilities } from "formwork/model";
import type {
  CapabilityLayer,
  CapabilityManifest,
  CapabilityMember,
  Diagnostic,
  EffectiveCapabilities,
  ModelDocument,
  DomainCapabilities,
  RouteDefinition,
  RouteTarget,
} from "formwork/model";

// Oxc 提供完整 ESTree；本分析器仅按 type 读取有限语法，不求值函数体。
type Ast = { type: string; start: number; end: number; [key: string]: any };
type Ref = { node: Ast; module: Module; declaration?: Ast };
type ImportRef = { from: string; name: string; node: Ast };
type Module = {
  file: string;
  code: string;
  program: Ast;
  bindings: Map<string, Ref | ImportRef>;
  exports: Map<string, Ref | ImportRef>;
  stars: string[];
};
/** 保存从实际 entry 可达的路由与共享能力，不转换 JSX。 */
export type FormworkAnalysis = {
  routes: RouteDefinition[];
  catalog: Pick<CapabilityManifest, "formatVersion" | "app" | "domains" | "pages">;
  files: Set<string>;
  capabilities: (
    document: Pick<ModelDocument, "id" | "domain">,
    target: RouteTarget,
  ) => EffectiveCapabilities;
};
/** 通过 Vite 的实际模块解析规则分析静态定义，不导入或执行应用 UI。 */
export async function analyzeFormwork(
  root: string,
  entry: string,
  resolver: (id: string, importer: string) => Promise<string | undefined>,
): Promise<FormworkAnalysis> {
  const modules = new Map<string, Module>();
  const source = (ref: Ref): NonNullable<Diagnostic["source"]> => {
    const preceding = ref.module.code.slice(0, ref.node.start);
    return {
      file: relative(root, ref.module.file).replaceAll("\\", "/"),
      line: preceding.split("\n").length,
      column: ref.node.start - preceding.lastIndexOf("\n"),
    };
  };
  const fail = (ref: Ref, message: string): never => {
    throw new FormworkError("TOOL_CONTRACT", message, [
      { code: "TOOL_CONTRACT", message, path: "", source: source(ref) },
    ]);
  };
  const load = async (file: string): Promise<Module> => {
    const cached = modules.get(file);
    if (cached) return cached;
    const code = await readFile(file, "utf8");
    const parsed = parseSync(file, code);
    if (parsed.errors.length)
      throw new FormworkError(
        "TOOL_CONTRACT",
        `${file}: ${parsed.errors.map((error) => error.message).join("; ")}`,
      );
    const module: Module = {
      file,
      code,
      program: parsed.program as Ast,
      bindings: new Map(),
      exports: new Map(),
      stars: [],
    };
    modules.set(file, module);
    const declarations = (node: Ast, exported: boolean) => {
      if (node.type === "VariableDeclaration") {
        for (const declaration of node.declarations as Ast[]) {
          if (declaration.id.type !== "Identifier") continue;
          const ref = { node: declaration.init ?? declaration.id, module, declaration: node };
          module.bindings.set(declaration.id.name, ref);
          if (exported) module.exports.set(declaration.id.name, ref);
        }
      } else if (node.id?.name) {
        const ref = { node, module, declaration: node };
        module.bindings.set(node.id.name, ref);
        if (exported) module.exports.set(node.id.name, ref);
      }
    };
    for (const node of module.program.body as Ast[]) {
      if (node.type === "ImportDeclaration") {
        if (node.importKind === "type") continue;
        for (const specifier of node.specifiers as Ast[])
          if (specifier.importKind !== "type")
            module.bindings.set(specifier.local.name, {
              from: node.source.value,
              name:
                specifier.type === "ImportNamespaceSpecifier"
                  ? "*"
                  : specifier.type === "ImportDefaultSpecifier"
                    ? "default"
                    : (specifier.imported.name ?? specifier.imported.value),
              node,
            });
      } else if (node.type === "ExportDefaultDeclaration")
        module.exports.set("default", { node: node.declaration, module, declaration: node });
      else if (node.type === "ExportNamedDeclaration") {
        if (node.exportKind === "type") continue;
        if (node.declaration) declarations(node.declaration, true);
        for (const specifier of node.specifiers as Ast[])
          module.exports.set(
            specifier.exported.name ?? specifier.exported.value,
            node.source
              ? {
                  from: node.source.value,
                  name: specifier.local.name ?? specifier.local.value,
                  node,
                }
              : { node: specifier.local, module },
          );
      } else if (node.type === "ExportAllDeclaration") module.stars.push(node.source.value);
      else declarations(node, false);
    }
    return module;
  };
  const resolveModule = async (from: string, module: Module, node: Ast): Promise<Module> => {
    const file = await resolver(from, module.file);
    if (!file || file.startsWith("\0") || file.includes("node_modules"))
      return fail({ module, node }, `无法静态定位 ${from}`);
    return load(file.split("?")[0]!);
  };
  const exportRef = async (
    module: Module,
    name: string,
    seen = new Set<string>(),
  ): Promise<Ref | ImportRef | undefined> => {
    const key = `${module.file}:${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const item = module.exports.get(name);
    if (item) return item;
    for (const star of module.stars) {
      const target = await resolveModule(star, module, module.program);
      const found = await exportRef(target, name, seen);
      if (found)
        return "from" in found
          ? {
              ...found,
              node: found.node,
              from: (await resolver(found.from, target.file)) ?? found.from,
            }
          : found;
    }
    return undefined;
  };
  const unwrap = async (ref: Ref, seen = new Set<string>()): Promise<Ref> => {
    const { node, module } = ref;
    if (
      [
        "TSAsExpression",
        "TSSatisfiesExpression",
        "TSNonNullExpression",
        "ParenthesizedExpression",
      ].includes(node.type)
    )
      return unwrap({ ...ref, node: node.expression }, seen);
    if (node.type === "Identifier") {
      const key = `${module.file}:${node.name}`;
      if (seen.has(key)) return fail(ref, `循环静态引用 ${node.name}`);
      seen.add(key);
      const binding = module.bindings.get(node.name);
      if (!binding) return ref;
      if ("from" in binding) {
        if (
          binding.from === "formwork" ||
          binding.from === "formwork/model" ||
          binding.name === "*"
        )
          return ref;
        const imported = await resolveModule(binding.from, module, binding.node);
        const value = await exportRef(imported, binding.name);
        if (!value) return fail(ref, `缺少导出 ${binding.name}`);
        if ("from" in value) {
          const proxy = { ...imported, bindings: new Map([[binding.name, value]]) };
          return unwrap({ node: { ...node, name: binding.name }, module: proxy }, seen);
        }
        return unwrap(value, seen);
      }
      return unwrap(binding, seen);
    }
    if (node.type === "MemberExpression" && node.object.type === "Identifier") {
      const binding = module.bindings.get(node.object.name);
      if (binding && "from" in binding && binding.name === "*") {
        const imported = await resolveModule(binding.from, module, binding.node);
        const name = node.computed
          ? await literal({ node: node.property, module })
          : node.property.name;
        const value = await exportRef(imported, String(name));
        if (!value || "from" in value) return fail(ref, `无法定位 namespace 成员 ${String(name)}`);
        return unwrap(value, seen);
      }
    }
    return ref;
  };
  const literal = async (input: Ref): Promise<string | boolean | number | null> => {
    const ref = await unwrap(input);
    if (ref.node.type === "Literal") return ref.node.value;
    return fail(ref, "定义 key 和 router 必须是可解析静态常量");
  };
  const object = async (input: Ref): Promise<Map<string, Ref>> => {
    const ref = await unwrap(input);
    if (ref.node.type === "Identifier") {
      const binding = ref.module.bindings.get(ref.node.name);
      if (binding && "from" in binding && binding.name === "*") {
        const target = await resolveModule(binding.from, ref.module, binding.node);
        const result = new Map<string, Ref>();
        const names = new Set(target.exports.keys());
        for (const star of target.stars)
          for (const name of (await resolveModule(star, target, target.program)).exports.keys())
            names.add(name);
        for (const name of names)
          if (name !== "default")
            result.set(name, {
              module: ref.module,
              node: {
                type: "MemberExpression",
                object: ref.node,
                property: { type: "Identifier", name, start: ref.node.start, end: ref.node.end },
                computed: false,
                start: ref.node.start,
                end: ref.node.end,
              },
            });
        return result;
      }
    }
    if (ref.node.type !== "ObjectExpression") return fail(ref, "定义或能力清单必须是静态对象");
    const result = new Map<string, Ref>();
    for (const property of ref.node.properties as Ast[]) {
      if (property.type === "SpreadElement") {
        for (const [key, value] of await object({ module: ref.module, node: property.argument }))
          result.set(key, value);
      } else {
        if (property.kind !== "init" || property.method)
          return fail({ node: property, module: ref.module }, "静态定义不支持 getter 或 method");
        const key = property.computed
          ? await literal({ node: property.key, module: ref.module })
          : (property.key.name ?? property.key.value);
        if (typeof key !== "string") return fail(ref, "能力 key 必须是字符串");
        result.set(key, { node: property.value, module: ref.module, declaration: property });
      }
    }
    return result;
  };
  const array = async (input: Ref): Promise<Ref[]> => {
    const ref = await unwrap(input);
    if (ref.node.type !== "ArrayExpression")
      return fail(ref, "domains 和 pages 必须为可解析静态数组");
    const result: Ref[] = [];
    for (const item of ref.node.elements as Ast[]) {
      if (!item) return fail(ref, "定义数组不允许空项");
      if (item.type === "SpreadElement")
        result.push(...(await array({ module: ref.module, node: item.argument })));
      else result.push({ module: ref.module, node: item });
    }
    return result;
  };
  const definitionObject = async (input: Ref, expected: string): Promise<Map<string, Ref>> => {
    const ref = await unwrap(input);
    const callee = ref.node.callee;
    const binding =
      callee?.type === "Identifier" ? ref.module.bindings.get(callee.name) : undefined;
    const name =
      binding && "from" in binding && binding.from === "formwork" ? binding.name : undefined;
    if (ref.node.type !== "CallExpression" || name !== expected || ref.node.arguments.length !== 1)
      return fail(ref, `预期可达的 ${expected}(静态对象)`);
    return object({ node: ref.node.arguments[0], module: ref.module });
  };
  const member = async (name: string, input: Ref): Promise<CapabilityMember> => {
    const ref = await unwrap(input);
    const declaration = ref.declaration ?? ref.node;
    const preceding = ref.module.code.slice(0, declaration.start);
    const comment = preceding
      .match(/\/\*\*([\s\S]*?)\*\/\s*(?:export\s+(?:default\s+)?)?$/u)?.[0]
      ?.trim();
    const bodies: Array<{ start: number; end: number }> = [];
    const collect = (node: Ast) => {
      if (!node || typeof node !== "object") return;
      if (
        ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(node.type)
      ) {
        bodies.push({ start: node.body.start, end: node.body.end });
        return;
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) for (const child of value) collect(child);
        else if (value && typeof value === "object") collect(value as Ast);
      }
    };
    collect(declaration);
    let signature = ref.module.code.slice(declaration.start, declaration.end);
    for (const body of bodies.sort((a, b) => b.start - a.start))
      signature =
        signature.slice(0, body.start - declaration.start) +
        "/* implementation omitted */" +
        signature.slice(body.end - declaration.start);
    return {
      name,
      source: source(ref),
      declaration: signature,
      ...(comment ? { jsDoc: comment.replace(/\s*export\s*(?:default\s*)?$/u, "") } : {}),
    };
  };
  const layer = async (values: Map<string, Ref>): Promise<CapabilityLayer> => {
    const result: CapabilityLayer = {
      components: [],
      formats: [],
      ui: await member("ui", values.get("ui")!),
      runtimeChecks: [],
    };
    for (const kind of ["components", "formats"] as const)
      if (values.has(kind)) {
        const members: CapabilityMember[] = [];
        for (const [key, ref] of await object(values.get(kind)!)) {
          if (!(kind === "formats" ? /^[\w-]+$/u : /^[A-Za-z_$][\w$]*$/u).test(key))
            return fail(ref, `非法 ${kind} key ${key}`);
          members.push(await member(key, ref));
        }
        result[kind] = members;
      }
    for (const name of ["inferFormat", "transformSchema"] as const)
      if (values.has(name)) result[name] = await member(name, values.get(name)!);
    const checks: Diagnostic[] = [
      {
        path: "",
        code: "RUNTIME_RENDER",
        message: "app.ui 映射、局部 RenderItem、字段契约与网络行为在实际挂载中验证",
      },
    ];
    for (const name of ["inferFormat", "transformSchema"] as const)
      if (result[name])
        checks.push({
          path: "",
          code: name === "inferFormat" ? "RUNTIME_FORMAT" : "RUNTIME_SCHEMA_TRANSFORM",
          message: `${name} 需要在浏览器预览中执行`,
          source: result[name]!.source,
        });
    result.runtimeChecks = checks;
    return result;
  };
  const reject = (values: Map<string, Ref>, names: readonly string[]) => {
    for (const name of names)
      if (values.has(name)) fail(values.get(name)!, `当前定义不支持 ${name}`);
  };
  const entryModule = await load(resolve(root, entry));
  const entryRef = await exportRef(entryModule, "default");
  if (!entryRef || "from" in entryRef)
    throw new FormworkError("TOOL_CONTRACT", "entry 必须导出 defineFormwork");
  const app = await definitionObject(entryRef, "defineFormwork");
  reject(app, ["layouts", "windows", "container", "schema", "fn", "presenters", "getSchema"]);
  for (const key of ["apis", "components", "ui", "domains", "pages"])
    if (!app.has(key)) throw new FormworkError("TOOL_CONTRACT", `Formwork 必须显式注册 ${key}`);
  const shared = await layer(app);
  const domains: Record<string, DomainCapabilities> = {};
  const pages: string[] = [];
  const names = new Set<string>();
  for (const [kind, factory] of [
    ["domains", "defineDomain"],
    ["pages", "definePage"],
  ] as const)
    for (const input of await array(app.get(kind)!)) {
      const values = await definitionObject(input, factory);
      const allowed =
        kind === "domains" ? ["router", "render", "transformSchema"] : ["router", "render"];
      reject(
        values,
        [...values.keys()].filter((name) => !allowed.includes(name)),
      );
      if (!values.has("router") || !values.has("render"))
        return fail(input, `${factory} 必须提供 router 和 render`);
      const router = String(await literal(values.get("router")!));
      if (!/^[a-z][a-z0-9-]*$/u.test(router) || names.has(router))
        return fail(input, `无效或重复 router ${router}`);
      names.add(router);
      const render = await unwrap(values.get("render")!);
      if (
        !["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(
          render.node.type,
        )
      )
        return fail(render, "render 必须是函数；插件不会转换 JSX");
      if (kind === "pages") pages.push(router);
      else {
        const transformSchema = values.has("transformSchema")
          ? await member("transformSchema", values.get("transformSchema")!)
          : undefined;
        domains[router] = {
          ...(transformSchema ? { transformSchema } : {}),
          runtimeChecks: transformSchema
            ? [
                {
                  path: "",
                  code: "RUNTIME_SCHEMA_TRANSFORM",
                  message: "Domain transformSchema 需要在浏览器预览中执行",
                  source: transformSchema.source,
                },
              ]
            : [],
        };
      }
    }
  const routes = createRoutes(
    Object.keys(domains).map((router) => ({ router })),
    pages.map((router) => ({ router })),
  );
  const catalog: FormworkAnalysis["catalog"] = {
    formatVersion: 1,
    app: shared,
    domains,
    pages,
  };
  return {
    routes,
    catalog,
    files: new Set(modules.keys()),
    capabilities: (document, target) =>
      manifestCapabilities(
        { ...catalog, appId: "", clientOrigin: "", revision: "" },
        document,
        target,
      ),
  };
}
