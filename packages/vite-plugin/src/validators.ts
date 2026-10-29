import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseSync } from "oxc-parser";
import { register } from "tsx/esm/api";
import { FormworkError, modelDocumentSchema } from "formwork/model";
import type { Diagnostic, ModelDocument } from "formwork/model";
import type { FormworkAnalysis } from "./analyze";

/** 校验 schema 运行依赖图后用隔离 TS loader 加载，刷新时重新建立缓存。 */
export function createValidatorLoader(
  analysis: FormworkAnalysis,
  resolver: (id: string, importer: string) => Promise<string | undefined>,
) {
  const cache = new Map<string, Promise<any>>();
  const files = new Set(analysis.files);
  const loader = register({ namespace: `formwork-${crypto.randomUUID()}` });
  const inspect = async (file: string, seen = new Set<string>()) => {
    if (seen.has(file)) return;
    seen.add(file);
    files.add(file);
    const code = await readFile(file, "utf8");
    const parsed = parseSync(file, code);
    if (parsed.errors.length) throw new FormworkError("TOOL_CONTRACT", `schema 无法解析 ${file}`);
    const names = (pattern: any): string[] => {
      if (!pattern) return [];
      if (pattern.type === "Identifier") return [pattern.name];
      if (pattern.type === "AssignmentPattern") return names(pattern.left);
      if (pattern.type === "RestElement") return names(pattern.argument);
      if (pattern.type === "ObjectPattern")
        return pattern.properties.flatMap((property: any) =>
          names(property.value ?? property.argument),
        );
      if (pattern.type === "ArrayPattern") return pattern.elements.flatMap(names);
      return [];
    };
    const visit = async (
      node: any,
      bound = new Set<string>(),
      parent?: any,
      key?: string,
    ): Promise<void> => {
      if (!node || typeof node !== "object") return;
      if (node.type?.startsWith("TS") || node.importKind === "type" || node.exportKind === "type")
        return;
      const locals = new Set(bound);
      if (node.params)
        for (const parameter of node.params) for (const name of names(parameter)) locals.add(name);
      if (node.type === "Program" || node.type === "BlockStatement")
        for (const statement of node.body) {
          const declaration = statement.declaration ?? statement;
          if (declaration.type === "VariableDeclaration")
            for (const variable of declaration.declarations)
              for (const name of names(variable.id)) locals.add(name);
          if (declaration.id?.name) locals.add(declaration.id.name);
          if (declaration.type === "ImportDeclaration")
            for (const specifier of declaration.specifiers) locals.add(specifier.local.name);
        }
      const propertyName =
        (parent?.type === "MemberExpression" && key === "property" && !parent.computed) ||
        (parent?.type === "Property" && key === "key" && !parent.computed);
      if (
        node.type?.startsWith("JSX") ||
        (node.type === "Identifier" &&
          !locals.has(node.name) &&
          !propertyName &&
          [
            "window",
            "document",
            "navigator",
            "fetch",
            "XMLHttpRequest",
            "WebSocket",
            "localStorage",
            "sessionStorage",
          ].includes(node.name))
      )
        throw new FormworkError(
          "TOOL_CONTRACT",
          `schema 运行依赖不能含 UI、DOM 或网络副作用: ${file}`,
        );
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
          "ImportExpression",
        ].includes(node.type) &&
        node.source &&
        node.importKind !== "type" &&
        node.exportKind !== "type"
      ) {
        const id = node.source.value;
        if (typeof id !== "string")
          throw new FormworkError("TOOL_CONTRACT", "schema 不支持动态依赖");
        if (!["zod", "formwork/model"].includes(id)) {
          const target = await resolver(id, file);
          if (!target || target.includes("node_modules") || id.startsWith("node:"))
            throw new FormworkError("TOOL_CONTRACT", `schema 依赖必须是 Node-safe 模型代码: ${id}`);
          await inspect(target, seen);
        }
      }
      for (const [childKey, value] of Object.entries(node))
        if (Array.isArray(value)) {
          for (const child of value) await visit(child, locals, node, childKey);
        } else if (value && typeof value === "object") await visit(value, locals, node, childKey);
    };
    await visit(parsed.program);
  };
  return {
    files,
    dispose: () => loader.unregister(),
    async validate(document: ModelDocument, router: string): Promise<Diagnostic[]> {
      const ref = analysis.validator(document.id, router);
      if (!ref) return [];
      let task = cache.get(ref.file);
      if (!task) {
        task = inspect(ref.file).then(() =>
          loader.import(pathToFileURL(ref.file).href, import.meta.url),
        );
        cache.set(ref.file, task);
      }
      const module = await task;
      const schema = module[ref.name];
      if (!schema || typeof schema.safeParseAsync !== "function")
        throw new FormworkError("TOOL_CONTRACT", `${ref.file}#${ref.name} 必须导出 Zod schema`);
      const result = await schema.safeParseAsync(document);
      if (!result.success)
        return result.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
          modelId: document.id,
          router,
          code: "INVALID_MODEL",
          path:
            "/" +
            issue.path
              .map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1"))
              .join("/"),
          message: issue.message,
          source: analysis.capabilities(document.id, router).schema?.source,
        }));
      const normalized = modelDocumentSchema.safeParse(result.data);
      if (!normalized.success || normalized.data.id !== document.id)
        return [
          {
            modelId: document.id,
            router,
            path: "/id",
            code: "INVALID_MODEL",
            message: "有效 validator 归一化后仍须满足最小模型契约与相同 id",
          },
        ];
      return [];
    },
  };
}
