import { z } from "zod";
import { FormworkError } from "./errors";
import { validateExpression, expressionBody } from "./expression";
import { cloneJson, escapePointer, isObject, pointerSegments } from "./pointer";
import { resolveSchema, schemaAt, schemaType, validateValue } from "./validation";
import { fieldPresentation, schemaFieldAt } from "./presentation";
import type {
  BackendDefinition,
  DataSchema,
  DraftDefinition,
  ManagedSnapshot,
  ModelDefinition,
  ModelDocument,
  ModelNavigationSnapshot,
  PreviewSnapshot,
  PublishedSnapshot,
  RuntimeSchema,
  RuntimeFieldDefinition,
  RuntimeSnapshot,
  RuntimeView,
  ValidationIssue,
} from "./types";

/** 固定模型与 router 的单段身份规则。 */
export const modelIdPattern = /^[a-z][a-z0-9_-]*$/u;
/** 禁止组件 props 覆盖框架拥有的受控绑定。 */
export const controlledProps = new Set([
  "value",
  "onChange",
  "readOnly",
  "disabled",
  "errors",
  "schema",
  "array",
  "Item",
  "children",
]);
const metadata = ["title", "description", "default", "readOnly"];

/** 检查完整模型子集并返回可定位的全部静态诊断。 */
export function modelIssues(
  input: unknown,
  options: { runtimeViews?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string, code = "INVALID_MODEL") =>
    issues.push({ path, code, message });
  const keys = (object: Record<string, unknown>, allowed: readonly string[], path: string) => {
    for (const key of Object.keys(object))
      if (!allowed.includes(key)) add(`${path}/${escapePointer(key)}`, `不支持的关键字 ${key}`);
  };
  if (!isObject(input)) return [{ path: "", code: "INVALID_MODEL", message: "模型必须是普通对象" }];
  try {
    const { views: _views, fields: _fields, ...base } = input;
    cloneJson((options.runtimeViews ? base : input) as never);
  } catch (error) {
    return [
      {
        path: "",
        code: "INVALID_MODEL",
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }
  keys(input, ["id", "domain", "title", "data", "fields", "tree", "views", "pages"], "");
  if (typeof input.id !== "string" || !modelIdPattern.test(input.id))
    add("/id", "id 必须是单段小写标识");
  if (input.domain !== undefined &&
      (typeof input.domain !== "string" || !modelIdPattern.test(input.domain)))
    add("/domain", "domain 必须是非空的单段小写标识");
  if (typeof input.title !== "string" || input.title.trim() === "")
    add("/title", "title 必须是非空字符串");
  const data = input.data;
  if (!isObject(data) || data.type !== "object") {
    add("/data", "根 data 必须为 object");
    return issues;
  }
  const root = data as ModelDocument["data"];
  const defaults: Array<{ schema: DataSchema; value: unknown; path: string }> = [];
  const visitSchema = (node: unknown, path: string, refs = new Set<string>()) => {
    if (!isObject(node)) {
      add(path, "schema 必须是对象");
      return;
    }
    for (const key of ["title", "description"])
      if (node[key] !== undefined && typeof node[key] !== "string")
        add(`${path}/${key}`, "需要字符串");
    if (node.readOnly !== undefined && typeof node.readOnly !== "boolean")
      add(`${path}/readOnly`, "需要 boolean");
    if (Object.hasOwn(node, "default"))
      defaults.push({ schema: node as DataSchema, value: node.default, path: `${path}/default` });
    const type = Array.isArray(node.type) ? node.type[0] : node.type;
    if (
      Array.isArray(node.type) &&
      (node.type.length !== 2 ||
        node.type[1] !== "null" ||
        !["string", "number", "integer", "boolean"].includes(String(type)))
    )
      add(`${path}/type`, "只支持 [scalar, null] 可空类型");
    const extras: Record<string, string[]> = {
      string: ["enum", "minLength", "maxLength", "pattern"],
      number: ["enum", "minimum", "maximum"],
      integer: ["enum", "minimum", "maximum"],
      boolean: ["enum"],
      null: [],
      object: ["properties", "required", "additionalProperties"],
      array: ["items", "minItems", "maxItems"],
    };
    keys(
      node,
      [
        ...metadata,
        ...(Object.hasOwn(node, "$ref") ? ["$ref"] : ["type", ...(extras[String(type)] ?? [])]),
        ...(path === "/data" ? ["$defs"] : []),
      ],
      path,
    );
    if (Object.hasOwn(node, "$ref")) {
      const ref = node.$ref;
      if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) {
        add(`${path}/$ref`, "仅支持 #/$defs/name");
        return;
      }
      if (refs.has(ref)) {
        add(`${path}/$ref`, "不支持循环 $ref");
        return;
      }
      try {
        const parts = pointerSegments(ref.slice(1));
        const defs = root.$defs;
        if (parts.length !== 2 || !defs || !Object.hasOwn(defs, parts[1]!))
          add(`${path}/$ref`, `悬空引用 ${ref}`);
        else visitSchema(defs[parts[1]!]!, `${path}/$ref`, new Set([...refs, ref]));
      } catch (error) {
        add(`${path}/$ref`, String(error));
      }
      return;
    }
    if (typeof type !== "string" || !Object.hasOwn(extras, type)) {
      add(`${path}/type`, "不支持的值类型");
      return;
    }
    if (type === "object") {
      if (!isObject(node.properties)) add(`${path}/properties`, "properties 必须是对象");
      else
        for (const [key, child] of Object.entries(node.properties))
          visitSchema(child, `${path}/properties/${escapePointer(key)}`, refs);
      if (
        node.required !== undefined &&
        (!Array.isArray(node.required) ||
          node.required.some(
            (key) =>
              typeof key !== "string" ||
              !isObject(node.properties) ||
              !Object.hasOwn(node.properties, key),
          ) ||
          new Set(node.required).size !== node.required.length)
      )
        add(`${path}/required`, "required 只能包含不重复的已声明字段");
      if (node.additionalProperties !== undefined && node.additionalProperties !== false)
        add(`${path}/additionalProperties`, "首版禁止未声明字段");
    }
    if (type === "array") visitSchema(node.items, `${path}/items`, refs);
    for (const [min, max, integer] of [
      ["minLength", "maxLength", true],
      ["minItems", "maxItems", true],
      ["minimum", "maximum", false],
    ] as const) {
      for (const key of [min, max])
        if (
          node[key] !== undefined &&
          (typeof node[key] !== "number" ||
            !Number.isFinite(node[key]) ||
            (integer && (!Number.isInteger(node[key]) || node[key] < 0)))
        )
          add(`${path}/${key}`, integer ? "需要非负整数" : "需要有限数");
      if (typeof node[min] === "number" && typeof node[max] === "number" && node[min] > node[max])
        add(`${path}/${max}`, `${max} 小于 ${min}`);
    }
    if (node.pattern !== undefined) {
      try {
        if (typeof node.pattern !== "string") throw new Error("pattern 必须是字符串");
        new RegExp(node.pattern, "u");
      } catch (error) {
        add(`${path}/pattern`, error instanceof Error ? error.message : String(error));
      }
    }
    if (node.enum !== undefined) {
      if (
        !Array.isArray(node.enum) ||
        node.enum.length === 0 ||
        new Set(node.enum.map((value) => JSON.stringify(value))).size !== node.enum.length
      )
        add(`${path}/enum`, "enum 必须是非空且不重复的标量数组");
      else
        for (let i = 0; i < node.enum.length; i++) {
          const value = node.enum[i];
          if (
            (value === null && !(Array.isArray(node.type) || type === "null")) ||
            (value !== null &&
              (typeof value !== (type === "integer" ? "number" : type) ||
                (type === "integer" && !Number.isInteger(value)) ||
                (typeof value === "number" && !Number.isFinite(value))))
          )
            add(`${path}/enum/${i}`, "enum 值类型必须匹配");
        }
    }
  };
  visitSchema(data, "/data");
  if (data.$defs !== undefined) {
    if (!isObject(data.$defs)) add("/data/$defs", "$defs 必须是对象");
    else
      for (const [key, child] of Object.entries(data.$defs))
        visitSchema(child, `/data/$defs/${escapePointer(key)}`);
  }
  for (const item of defaults) {
    try {
      if (item.value === undefined) throw new Error("default 必须是 JSON 值");
      cloneJson(item.value as never);
      for (const issue of validateValue(item.schema, item.value, root))
        add(`${item.path}${issue.path}`, `default: ${issue.message}`);
    } catch (error) {
      add(item.path, String(error));
    }
  }
  const visitView = (node: unknown, path: string, base: DataSchema | undefined) => {
    if (!isObject(node)) {
      add(path, "ViewNode 必须是对象");
      return;
    }
    keys(node, ["component", "field", "props", "bindings", "children"], path);
    if (
      (node.component !== undefined && (typeof node.component !== "string" || !node.component)) ||
      (node.component === undefined && node.field === undefined)
    )
      add(`${path}/component`, "需要非空 component 或绑定 field 以推导组件");
    let childBase = base;
    if (node.field !== undefined) {
      if (typeof node.field !== "string") add(`${path}/field`, "field 必须是 Pointer");
      else {
        try {
          pointerSegments(node.field);
          if (base && issues.length === 0) {
            const schema = schemaAt(base, node.field, root).schema;
            childBase = "items" in schema ? resolveSchema(schema.items, root) : schema;
          }
        } catch (error) {
          add(
            `${path}/field`,
            error instanceof Error ? error.message : String(error),
            "UNKNOWN_FIELD",
          );
        }
      }
    }
    if (node.props !== undefined) {
      if (!isObject(node.props)) add(`${path}/props`, "props 必须是对象");
      else
        for (const [key, value] of Object.entries(node.props)) {
          const propPath = `${path}/props/${escapePointer(key)}`;
          if (controlledProps.has(key)) add(propPath, `受控属性 ${key} 只能通过 bindings 配置`);
          try {
            if (!options.runtimeViews) cloneJson(value as never);
            if (expressionBody(value) !== undefined) validateExpression(String(value));
          } catch (error) {
            add(
              propPath,
              error instanceof Error ? error.message : String(error),
              "INVALID_EXPRESSION",
            );
          }
        }
    }
    if (node.bindings !== undefined) {
      if (!isObject(node.bindings)) add(`${path}/bindings`, "bindings 必须是对象");
      else {
        keys(node.bindings, ["value", "readOnly", "disabled", "visible"], `${path}/bindings`);
        if (Object.hasOwn(node.bindings, "value") && node.field === undefined)
          add(`${path}/bindings/value`, "value writer 必须绑定字段");
        for (const [key, value] of Object.entries(node.bindings)) {
          if (typeof value === "boolean" && key !== "value") continue;
          try {
            if (typeof value !== "string") throw new Error("需要 {{ ... }} 表达式");
            validateExpression(value);
          } catch (error) {
            add(
              `${path}/bindings/${key}`,
              error instanceof Error ? error.message : String(error),
              "INVALID_EXPRESSION",
            );
          }
        }
      }
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) add(`${path}/children`, "children 必须是数组");
      else
        node.children.forEach((child, i) => visitView(child, `${path}/children/${i}`, childBase));
    }
  };
  if (input.fields !== undefined) {
    if (!isObject(input.fields)) add("/fields", "fields 必须是字段 Pointer 到展示配置的对象");
    else
      for (const [pointer, definition] of Object.entries(input.fields)) {
        const path = `/fields/${escapePointer(pointer)}`;
        try {
          if (schemaFieldAt(root, pointer).path !== pointer)
            add(path, "数组项字段配置必须使用 *，不能固定数组索引");
        } catch (error) {
          add(path, error instanceof Error ? error.message : String(error), "UNKNOWN_FIELD");
        }
        if (!isObject(definition)) {
          add(path, "字段配置必须是对象");
          continue;
        }
        keys(definition, ["order", "form", "table", "filter"], path);
        if (definition.order !== undefined && !Number.isSafeInteger(definition.order))
          add(`${path}/order`, "order 必须是安全整数");
        for (const mode of ["form", "table", "filter"] as const) {
          const presentation = definition[mode];
          if (presentation === undefined || (mode !== "form" && presentation === false)) continue;
          const location = `${path}/${mode}`;
          if (!isObject(presentation)) {
            add(location, "需要展示配置对象，table/filter 也可设为 false");
            continue;
          }
          keys(
            presentation,
            ["component", "props", "bindings", ...(mode === "table" ? ["title"] : [])],
            location,
          );
          if (
            mode === "table" &&
            presentation.title !== undefined &&
            typeof presentation.title !== "string"
          )
            add(`${location}/title`, "title 必须是字符串");
          const { title: _title, ...view } = presentation;
          visitView({ ...view, field: "" }, location, undefined);
          if (
            mode !== "form" &&
            isObject(presentation.bindings) &&
            presentation.bindings.value !== undefined
          )
            add(`${location}/bindings/value`, "value writer 只能在 form 中声明");
        }
      }
  }
  if (input.tree !== undefined) {
    if (!isObject(input.tree)) add("/tree", "tree 必须描述 parentField 和 labelField");
    else {
      keys(input.tree, ["parentField", "labelField"], "/tree");
      for (const name of ["parentField", "labelField"] as const) {
        try {
          const pointer = input.tree[name];
          if (typeof pointer !== "string" || pointerSegments(pointer).length !== 1)
            throw new Error("tree 字段必须是根字段 Pointer");
          const schema = schemaFieldAt(root, pointer).schema;
          if (schemaType(schema) !== "string")
            throw new Error("tree 字段必须为 string 或可空 string");
        } catch (error) {
          add(
            `/tree/${name}`,
            error instanceof Error ? error.message : String(error),
            "UNKNOWN_FIELD",
          );
        }
      }
      if (input.tree.parentField === input.tree.labelField)
        add("/tree/labelField", "父级字段与名称字段不能相同");
    }
  }
  if (input.views !== undefined) {
    if (!isObject(input.views)) add("/views", "views 必须是对象");
    // 文档层不知道 View 的实际 scope；路由能力和 Render 分别检查已确定的字段。
    else
      for (const [key, view] of Object.entries(input.views))
        visitView(view, `/views/${escapePointer(key)}`, undefined);
  }
  if (input.pages !== undefined) {
    if (!isObject(input.pages)) add("/pages", "pages 必须是 Page 配置映射");
    else for (const [router, page] of Object.entries(input.pages)) {
      const path = `/pages/${escapePointer(router)}`;
      if (!modelIdPattern.test(router)) add(path, "无效 Page 名称");
      if (!isObject(page)) {
        add(path, "Page 配置必须是对象");
        continue;
      }
      keys(page, ["windows"], path);
      if (page.windows === undefined) continue;
      if (!isObject(page.windows)) {
        add(`${path}/windows`, "windows 必须是本地 Window 配置映射");
        continue;
      }
      for (const [name, window] of Object.entries(page.windows)) {
        const location = `${path}/windows/${escapePointer(name)}`;
        if (!modelIdPattern.test(name)) add(location, "无效 Window 名称");
        if (!isObject(window)) {
          add(location, "Window 配置必须是对象");
          continue;
        }
        keys(window, ["openMode"], location);
        if (window.openMode !== undefined &&
            !["page", "drawer", "modal"].includes(String(window.openMode)))
          add(`${location}/openMode`, "openMode 必须为 page、drawer 或 modal", "INVALID_OPEN_MODE");
      }
    }
  }
  return issues;
}

/** 校验最小完整文档和 JSON Schema 子集，并保留原文内容。 */
export const modelDocumentSchema: z.ZodType<ModelDocument> = z
  .unknown()
  .superRefine((input, ctx) => {
    for (const issue of modelIssues(input))
      ctx.addIssue({
        code: "custom",
        path: pointerSegments(issue.path),
        message: `${issue.code}: ${issue.message}`,
      });
  })
  .transform((value) => value as ModelDocument);

/** 验证 Domain 的实际渲染 schema，保留 View props 中的代码身份。 */
export function assertRuntimeSchema(input: unknown): RuntimeSchema {
  const issues = modelIssues(input, { runtimeViews: true });
  if (issues.length) throw new FormworkError("INVALID_MODEL", "RuntimeSchema 校验失败", issues);
  return input as RuntimeSchema;
}

/** 验证草稿传输和身份，允许保存尚未有效的 schema/backend。 */
export function assertDraftDefinition(input: unknown, modelId: string): DraftDefinition {
  if (!isObject(input) || !isObject(input.document) || input.document.id !== modelId)
    throw new FormworkError("INVALID_INPUT", "definition.document.id 必须匹配 modelId");
  try {
    return cloneJson(input as never) as DraftDefinition;
  } catch {
    throw new FormworkError("INVALID_INPUT", "definition 必须是可序列化的 JSON 对象");
  }
}

const identity = z.string().regex(modelIdPattern);
/** 校验当前账号的菜单快照，拒绝不符合模型身份规则的入口。 */
export const modelNavigationSchema: z.ZodType<ModelNavigationSnapshot> = z
  .object({
    systemModels: z.array(z.object({ id: identity, title: z.string() }).strict()),
    pinnedModels: z.array(z.object({ id: identity, title: z.string() }).strict()),
    pinnableModelIds: z.array(identity),
  })
  .strict();
const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);
/** 校验后端配置结构；存储所有权和目标模型在 Worker 中进一步检查。 */
export const backendDefinitionSchema: z.ZodType<BackendDefinition> = z
  .object({
    storage: z
      .object({
        table: identifier,
        bindings: z.array(
          z
            .object({
              id: z.string().min(1),
              path: z.string(),
              column: identifier.optional(),
              jsonKey: z.string().min(1).optional(),
              sqlType: z.enum(["TEXT", "INTEGER", "REAL"]),
              encoding: z.enum(["scalar", "json"]),
              index: z.enum(["index", "unique"]).optional(),
            })
            .strict(),
        ),
      })
      .strict(),
    relations: z.array(
      z
        .object({
          fieldId: z.string().min(1),
          targetModel: identity,
          targetFieldId: z.string().min(1),
          kind: z.enum(["many-to-one", "many-to-many"]),
          through: identifier.optional(),
        })
        .strict(),
    ),
    permissions: z
      .object({
        grants: z.array(
          z
            .object({
              roleId: z.string().min(1),
              actions: z.array(z.enum(["read", "create", "update", "delete", "manage", "publish"])),
              fields: z.array(z.string().min(1)).optional(),
              scope: z.enum(["all", "own"]),
            })
            .strict(),
        ),
        privateFields: z.array(z.string().min(1)),
      })
      .strict(),
    behavior: z
      .object({
        rules: z.array(z.string().min(1)),
        commands: z.record(z.string(), z.string().min(1)),
        events: z.record(z.string(), z.array(z.string().min(1))),
      })
      .strict(),
  })
  .strict();

/** 校验完整发布定义；草稿保存不调用此严格解析器。 */
export const modelDefinitionSchema: z.ZodType<ModelDefinition> = z
  .object({ document: modelDocumentSchema, backend: backendDefinitionSchema })
  .strict();
const issueSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
  modelId: z.string().optional(),
  router: z.string().optional(),
  window: z.string().optional(),
  source: z
    .object({ file: z.string(), line: z.number().int(), column: z.number().int() })
    .optional(),
});
/** 校验诊断报告的 HTTP envelope。 */
export const validationReportSchema = z
  .object({ errors: z.array(issueSchema), runtimeChecks: z.array(issueSchema) })
  .strict();
/** 校验管理目录中的能力和阶段，不包含运行时源位置。 */
export const managedEntrySchema = z
  .object({
    id: identity,
    title: z.string(),
    revision: z.string().min(1),
    stage: z.enum(["draft", "published"]),
    publishedVersion: z.number().int().positive().nullable(),
    canManage: z.boolean(),
    canPublish: z.boolean(),
  })
  .strict();
const managedSnapshotSchema = managedEntrySchema.extend({
  definition: z.unknown(),
  baseVersion: z.number().int().positive().nullable(),
  diagnostics: validationReportSchema,
});
/** 验证管理快照，但不把无效草稿当成无效 HTTP 返回。 */
export function assertManagedSnapshot(input: unknown, modelId: string): ManagedSnapshot {
  const parsed = managedSnapshotSchema.parse(input);
  if (parsed.id !== modelId) throw new FormworkError("INVALID_MODEL", "快照 id 与请求不一致");
  return { ...parsed, definition: assertDraftDefinition(parsed.definition, modelId) };
}
/** 校验完整且不可变的发布版本，拒绝运行时权限投影。 */
export function assertPublishedSnapshot(input: unknown, modelId: string): PublishedSnapshot {
  const parsed = z
    .object({
      id: identity,
      version: z.number().int().positive(),
      revision: z.string().min(1),
      definition: modelDefinitionSchema,
    })
    .strict()
    .parse(input);
  if (parsed.id !== modelId || parsed.definition.document.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "发布快照 id 与请求不一致");
  return parsed;
}
/** 校验授权后的普通页面 schema envelope。 */
export function assertRuntimeSnapshot(input: unknown, modelId: string): RuntimeSnapshot {
  const parsed = z
    .object({
      schema: modelDocumentSchema,
      version: z.number().int().positive(),
      revision: z.string().min(1),
    })
    .strict()
    .parse(input);
  if (parsed.schema.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "运行时 schema id 与请求不一致");
  return parsed;
}
/** 校验管理预览 envelope；baseVersion 可以为空。 */
export function assertPreviewSnapshot(input: unknown, modelId: string): PreviewSnapshot {
  const parsed = z
    .object({
      schema: modelDocumentSchema,
      managementRevision: z.string().min(1),
      stage: z.enum(["draft", "published"]),
      baseVersion: z.number().int().positive().nullable(),
    })
    .strict()
    .parse(input);
  if (parsed.schema.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "预览 schema id 与请求不一致");
  return parsed;
}

/** 从 schema 生成默认组件名称，标量 enum 优先选择 Select。 */
export function defaultComponent(schema: DataSchema, root: DataSchema = schema): string {
  schema = resolveSchema(schema, root);
  if ("enum" in schema && schema.enum) return "Select";
  return {
    string: "Input",
    number: "NumberInput",
    integer: "NumberInput",
    boolean: "Switch",
    object: "Object",
    array: "Array",
    null: "Null",
  }[schemaType(schema)]!;
}

/** 检查当前 Render 已确定的组件和字段引用。 */
export function viewIssues(
  view: RuntimeView,
  schema: DataSchema,
  components: readonly string[],
  root: DataSchema = schema,
  path = "",
  fields?: Readonly<Record<string, RuntimeFieldDefinition>>,
  base = "",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let bound = schema;
  let fieldPath = base;
  if (view.field !== undefined) fieldPath += view.field;
  if (view.field !== undefined) {
    try {
      bound = schemaAt(schema, view.field, root).schema;
    } catch (error) {
      issues.push({
        path: `${path}/field`,
        code: "UNKNOWN_FIELD",
        message: error instanceof Error ? error.message : String(error),
      });
      return issues;
    }
  }
  const presentation =
    view.field === undefined ? {} : fieldPresentation(fields, root, fieldPath, "form");
  const component =
    view.component ??
    presentation.component ??
    (view.field !== undefined ? defaultComponent(bound, root) : undefined);
  if (!component || !components.includes(component))
    issues.push({
      path: `${path}/component`,
      code: "UNKNOWN_COMPONENT",
      message: `未注册组件 ${component ?? "(未声明)"}`,
    });
  const childSchema = "items" in bound ? resolveSchema(bound.items, root) : bound;
  const childBase = "items" in bound ? `${fieldPath}/*` : fieldPath;
  if (view.children)
    view.children.forEach((child, index) =>
      issues.push(
        ...viewIssues(
          child,
          childSchema,
          components,
          root,
          `${path}/children/${index}`,
          fields,
          childBase,
        ),
      ),
    );
  else if (view.field !== undefined) {
    const walkDefault = (node: DataSchema, location: string, pointer: string) => {
      node = resolveSchema(node, root);
      const component =
        fieldPresentation(fields, root, pointer, "form").component ?? defaultComponent(node, root);
      if (!components.includes(component))
        issues.push({
          path: location,
          code: "UNKNOWN_COMPONENT",
          message: `缺少默认组件 ${component}`,
        });
      if ("properties" in node)
        for (const [key, child] of Object.entries(node.properties))
          walkDefault(
            child,
            `${location}/${escapePointer(key)}`,
            `${pointer}/${escapePointer(key)}`,
          );
      if ("items" in node) walkDefault(node.items, `${location}/items`, `${pointer}/*`);
    };
    if ("properties" in bound)
      for (const [key, child] of Object.entries(bound.properties))
        walkDefault(child, `${path}/${escapePointer(key)}`, `${fieldPath}/${escapePointer(key)}`);
    if ("items" in bound) walkDefault(bound.items, `${path}/items`, `${fieldPath}/*`);
  }
  return issues;
}

/** 检查字段展示配置引用的组件，供发布、能力清单升级与浏览器挂载共用。 */
export function fieldIssues(
  fields: Readonly<Record<string, RuntimeFieldDefinition>> | undefined,
  components: readonly string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [pointer, definition] of Object.entries(fields ?? {})) {
    for (const mode of ["form", "table", "filter"] as const) {
      const presentation = definition[mode];
      if (presentation && presentation.component && !components.includes(presentation.component))
        issues.push({
          path: `/fields/${escapePointer(pointer)}/${mode}/component`,
          code: "UNKNOWN_COMPONENT",
          message: `未注册组件 ${presentation.component}`,
        });
    }
  }
  return issues;
}
