import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { FormworkError, modelIdPattern, validateRoutes } from "formwork/model";
import type { Diagnostic, RouteDefinition } from "formwork/model";
import type { CapabilityMember, EffectiveCapabilities } from "formwork/mcp";

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
type Layer = {
  components: Record<string, CapabilityMember>;
  fn: Record<string, CapabilityMember>;
  schema?: { member: CapabilityMember; file: string; name: string };
  getSchema?: CapabilityMember;
};
type Definition = {
  route: RouteDefinition;
  layer: Layer;
  domains: Record<string, Layer>;
  schema: boolean;
};
/** 保存从实际 entry 可达的路由、覆盖能力和 JSX 转换范围。 */
export type FormworkAnalysis = {
  routes: RouteDefinition[];
  domainIds: string[];
  schemaRouters: string[];
  files: Set<string>;
  transforms: Map<string, Array<{ start: number; end: number }>>;
  capabilities: (modelId: string, router: string) => EffectiveCapabilities;
  validator: (modelId: string, router: string) => { file: string; name: string } | undefined;
};
/** 通过 Vite 的实际模块解析规则分析静态定义，不导入或执行应用 UI。 */
export async function analyzeFormwork(
  root: string,
  entry: string,
  resolver: (id: string, importer: string) => Promise<string | undefined>,
): Promise<FormworkAnalysis> {
  const modules = new Map<string, Module>();
  const transforms: FormworkAnalysis["transforms"] = new Map();
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
    return fail(ref, "定义 key、router、path、presentation 和 returnTo 必须是可解析静态常量");
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
    if (ref.node.type !== "ArrayExpression") return fail(ref, "pages/windows 必须为可解析静态数组");
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
    return {
      name,
      source: source(ref),
      declaration: ref.module.code.slice(declaration.start, declaration.end),
      ...(comment ? { jsDoc: comment.replace(/\s*export\s*(?:default\s*)?$/u, "") } : {}),
    };
  };
  const layer = async (values: Map<string, Ref>): Promise<Layer> => {
    const result: Layer = { components: {}, fn: {} };
    for (const kind of ["components", "fn"] as const)
      if (values.has(kind))
        for (const [key, ref] of await object(values.get(kind)!)) {
          if (!/^[A-Za-z_$][\w$]*$/u.test(key)) return fail(ref, `非法 ${kind} key ${key}`);
          result[kind][key] = await member(key, ref);
        }
    if (values.has("schema")) {
      const ref = await unwrap(values.get("schema")!);
      if (!ref.module.file.endsWith(".schema.ts"))
        return fail(ref, "schema 必须静态定位到 Node-safe *.schema.ts 导出");
      const exported = [...ref.module.exports].find(
        ([, value]) => !("from" in value) && value.node.start === ref.node.start,
      )?.[0];
      if (!exported) return fail(ref, "schema 必须是具名或 default 导出");
      result.schema = {
        member: await member(exported, ref),
        file: ref.module.file,
        name: exported,
      };
    }
    if (values.has("getSchema"))
      result.getSchema = await member("getSchema", values.get("getSchema")!);
    return result;
  };
  const domainLayers = async (input: Ref): Promise<Record<string, Layer>> => {
    const result: Record<string, Layer> = {};
    for (const [id, value] of await object(input)) {
      if (!modelIdPattern.test(id)) return fail(value, `非法 Domain id ${id}`);
      let ref = await unwrap(value);
      if (ref.node.type === "ArrowFunctionExpression") {
        if (ref.node.body.type !== "ImportExpression" || ref.node.body.source.type !== "Literal")
          return fail(ref, "Domain loader 必须使用显式动态 import");
        const target = await resolveModule(ref.node.body.source.value, ref.module, ref.node);
        const exported = await exportRef(target, "default");
        if (!exported || "from" in exported)
          return fail(ref, "Domain 模块缺少 default defineDomain");
        ref = exported;
      }
      result[id] = await layer(await definitionObject(ref, "defineDomain"));
    }
    return result;
  };
  const entryModule = await load(resolve(root, entry));
  const entryRef = await exportRef(entryModule, "default");
  if (!entryRef || "from" in entryRef)
    throw new FormworkError("TOOL_CONTRACT", "entry 必须导出 defineFormwork");
  const app = await definitionObject(entryRef, "defineFormwork");
  const global = await layer(app);
  const definitions: Definition[] = [];
  for (const kind of ["pages", "windows"] as const)
    if (app.has(kind))
      for (const input of await array(app.get(kind)!)) {
        const values = await definitionObject(
          input,
          kind === "pages" ? "definePage" : "defineWindow",
        );
        if (!values.has("router")) return fail(input, "定义缺少 router");
        const route: RouteDefinition = { router: String(await literal(values.get("router")!)) };
        for (const key of ["path", "presentation", "returnTo"] as const)
          if (values.has(key))
            (route as Record<string, unknown>)[key] = await literal(values.get(key)!);
        if (kind === "windows" && !["page", "modal", "drawer"].includes(route.presentation ?? ""))
          return fail(input, "Window 必须声明固定 presentation");
        if (kind === "pages" && route.presentation)
          return fail(input, "Page 不能声明 presentation");
        const render = values.get("render");
        if (render) {
          if (values.has("container") || values.has("schema") || values.has("getSchema"))
            return fail(render, "plain render 与 schema 内容互斥");
          const ref = await unwrap(render);
          if (["JSXElement", "JSXFragment"].includes(ref.node.type)) {
            const ranges = transforms.get(ref.module.file) ?? [];
            if (!ranges.some((range) => range.start === ref.node.start))
              ranges.push({ start: ref.node.start, end: ref.node.end });
            transforms.set(ref.module.file, ranges);
          }
        }
        definitions.push({
          route,
          layer: await layer(values),
          domains: values.has("domains") ? await domainLayers(values.get("domains")!) : {},
          schema: !render,
        });
      }
  const routes = definitions.map((definition) => definition.route);
  validateRoutes(routes);
  const layers = (id: string, router: string) => {
    const definition = definitions.find((value) => value.route.router === router);
    if (!definition) throw new FormworkError("UNKNOWN_ROUTER", `未知 router ${router}`);
    return [global, definition.layer, ...(definition.domains[id] ? [definition.domains[id]!] : [])];
  };
  const merge = (values: Layer[], kind: "components" | "fn") => {
    const result: Record<string, CapabilityMember> = {};
    for (const value of values)
      for (const [key, next] of Object.entries(value[kind])) {
        const previous = result[key];
        result[key] = previous
          ? { ...next, overrides: [...(previous.overrides ?? []), previous.source] }
          : next;
      }
    return Object.values(result);
  };
  return {
    routes,
    domainIds: [
      ...new Set(definitions.flatMap((definition) => Object.keys(definition.domains))),
    ].sort(),
    schemaRouters: definitions
      .filter((definition) => definition.schema)
      .map((definition) => definition.route.router),
    files: new Set(modules.keys()),
    transforms,
    capabilities(id, router) {
      const values = layers(id, router);
      const schema = values.findLast((value) => value.schema)?.schema;
      return {
        modelId: id,
        router,
        components: merge(values, "components"),
        fn: merge(values, "fn"),
        schema: schema?.member,
        modelContract:
          "ModelDocument: { id, title, data: JSON Schema subset, views? }; source requires completeness:full and ifRevision",
        runtimeChecks: [
          {
            modelId: id,
            router,
            path: "",
            code: "RUNTIME_RENDER",
            message:
              "局部 Render 的 query schema、组件覆盖、表达式返回值与网络行为在实际挂载中验证",
          },
        ],
      };
    },
    validator(id, router) {
      return layers(id, router).findLast((value) => value.schema)?.schema;
    },
  };
}
