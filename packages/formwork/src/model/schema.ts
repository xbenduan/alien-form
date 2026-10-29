import { z } from "zod";
import { FormworkError } from "./errors";
import { validateExpression, expressionBody } from "./expression";
import { cloneJson, escapePointer, isObject, pointerSegments } from "./pointer";
import { resolveSchema, schemaAt, schemaType, validateValue } from "./validation";
import type {
  BackendDefinition,
  DataSchema,
  DraftDefinition,
  ManagedSnapshot,
  ModelDefinition,
  ModelDocument,
  PreviewSnapshot,
  PublishedSnapshot,
  RuntimeSchema,
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
    const { views: _views, ...base } = input;
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
  keys(input, ["id", "title", "data", "views"], "");
  if (typeof input.id !== "string" || !modelIdPattern.test(input.id))
    add("/id", "id 必须是单段小写标识");
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
    if (typeof node.component !== "string" || !node.component)
      add(`${path}/component`, "component 必须是非空名称");
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
  if (input.views !== undefined) {
    if (!isObject(input.views)) add("/views", "views 必须是对象");
    // 文档层不知道 View 的实际 scope；路由能力和 Render 分别检查已确定的字段。
    else
      for (const [key, view] of Object.entries(input.views))
        visitView(view, `/views/${escapePointer(key)}`, undefined);
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
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let bound = schema;
  if (!components.includes(view.component))
    issues.push({
      path: `${path}/component`,
      code: "UNKNOWN_COMPONENT",
      message: `未注册组件 ${view.component}`,
    });
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
  const childSchema = "items" in bound ? resolveSchema(bound.items, root) : bound;
  if (view.children)
    view.children.forEach((child, index) =>
      issues.push(...viewIssues(child, childSchema, components, root, `${path}/children/${index}`)),
    );
  else if (view.field !== undefined) {
    const walkDefault = (node: DataSchema, location: string) => {
      node = resolveSchema(node, root);
      const component = defaultComponent(node, root);
      if (!components.includes(component))
        issues.push({
          path: location,
          code: "UNKNOWN_COMPONENT",
          message: `缺少默认组件 ${component}`,
        });
      if ("properties" in node)
        for (const [key, child] of Object.entries(node.properties))
          walkDefault(child, `${location}/${escapePointer(key)}`);
      if ("items" in node) walkDefault(node.items, `${location}/items`);
    };
    if ("properties" in bound)
      for (const [key, child] of Object.entries(bound.properties))
        walkDefault(child, `${path}/${escapePointer(key)}`);
    if ("items" in bound) walkDefault(bound.items, `${path}/items`);
  }
  return issues;
}
