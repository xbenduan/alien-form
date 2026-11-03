import { z } from "zod";
import { FormworkError } from "./errors";
import { cloneJson, escapePointer, isObject, pointerSegments } from "./pointer";
import {
  baseFieldSchema,
  enumOptions,
  frameworkFormats,
  resolveFieldSchema,
  resolveModel,
} from "./field";
import type { FieldContract, FormatDefinition } from "./field";
import { validateValue } from "./validation";
import type {
  BackendOptions,
  DraftDefinition,
  FieldSchema,
  ManagedSnapshot,
  ModelDefinition,
  ModelDocument,
  ModelNavigationSnapshot,
  PreviewSnapshot,
  PublishedSnapshot,
  RuntimeSchema,
  RuntimeSnapshot,
  ValidationIssue,
} from "./types";
export { controlledProps } from "./field";

/** 固定模型与 router 的单段身份规则。 */
export const modelIdPattern = /^[a-z][a-z0-9_-]*$/u;
const identity = z.string().regex(modelIdPattern);
const permissions = z
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
  .strict();
/** 校验作者可配置的后端策略，不接受派生 bindings 和 relations。 */
export const backendDefinitionSchema: z.ZodType<BackendOptions> = z
  .object({
    storage: z
      .object({
        table: z
          .string()
          .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u)
          .optional(),
      })
      .strict()
      .optional(),
    permissions: permissions.optional(),
    behavior: z
      .object({
        rules: z.array(z.string().min(1)).optional(),
        commands: z.record(z.string(), z.string().min(1)).optional(),
        events: z.record(z.string(), z.array(z.string().min(1))).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const documentShape = z
  .object({
    schemaVersion: z.literal(1),
    id: identity,
    domain: identity.optional(),
    title: z.string(),
    data: z.record(z.string(), baseFieldSchema),
    $defs: z.record(z.string(), baseFieldSchema).optional(),
    tree: z.object({ parentField: z.string(), labelField: z.string() }).strict().optional(),
  })
  .strict();
/** 公开可序列化的作者结构，供 MCP 与编辑器生成 JSON Schema。 */
export const definitionStructureSchema = documentShape.extend({
  backend: backendDefinitionSchema.optional(),
});
const definitionShape = definitionStructureSchema;
const issuePath = (path: readonly PropertyKey[]) =>
  `/${path.map((part) => escapePointer(String(part))).join("/")}`;
type ModelCheckOptions = FieldContract & { allowUnknownFormats?: boolean };

/** 验证作者字段协议及 format 契约，所有诊断使用作者文档地址。 */
export function modelIssues(input: unknown, options: ModelCheckOptions = {}): ValidationIssue[] {
  const parsed = definitionShape.safeParse(input, { jitless: true });
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string, code = "INVALID_MODEL") =>
    issues.push({ path, code, message });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) add(issuePath(issue.path), issue.message);
    if (isObject(input))
      for (const key of ["document", "views", "pages", "fields", "layout"])
        if (key in input)
          add(
            `/${key}`,
            `${key} 已移除；请显式迁移字段配置，布局由 Page/Window 代码承载`,
            "MIGRATION_REQUIRED",
          );
    return issues;
  }
  const document = parsed.data;
  const formats: Record<string, FormatDefinition> = { ...options.formats };
  const fieldIds = new Set<string>();
  const walk = (source: FieldSchema, path: string, refs = new Set<string>()) => {
    let field: FieldSchema;
    try {
      if (source.$ref && refs.has(source.$ref)) throw new Error(`循环引用 ${source.$ref}`);
      field = resolveFieldSchema(source, document);
    } catch (error) {
      add(`${path}/$ref`, error instanceof Error ? error.message : String(error));
      return;
    }
    const nextRefs = new Set(refs);
    if (source.$ref) {
      nextRefs.add(source.$ref);
      const allowed = [
        "$ref",
        "id",
        "title",
        "description",
        "required",
        "readOnly",
        "props",
        "ui",
        "storage",
        "query",
      ];
      for (const key of Object.keys(source))
        if (!allowed.includes(key)) add(`${path}/${key}`, "$ref 只允许元信息和展示覆盖");
    }
    if (!field.type) add(`${path}/type`, "字段必须声明 type 或有效 $ref");
    if (source.id) {
      if (path.startsWith("/$defs/"))
        add(`${path}/id`, "$defs 不携带物理字段 id，请在引用使用点声明");
      if (fieldIds.has(source.id)) add(`${path}/id`, "稳定字段 id 重复");
      fieldIds.add(source.id);
    }
    for (const [lower, upper] of [
      ["minLength", "maxLength"],
      ["minimum", "maximum"],
      ["minItems", "maxItems"],
    ] as const)
      if (field[lower] !== undefined && field[upper] !== undefined && field[lower]! > field[upper]!)
        add(`${path}/${upper}`, `${upper} 不得小于 ${lower}`);
    const allowedConstraints: Record<string, readonly string[]> = {
      minLength: ["string"],
      maxLength: ["string"],
      pattern: ["string"],
      minimum: ["number", "integer"],
      maximum: ["number", "integer"],
      minItems: ["array"],
      maxItems: ["array"],
      properties: ["object"],
      additionalProperties: ["object"],
      items: ["array"],
    };
    for (const [name, types] of Object.entries(allowedConstraints))
      if (name in field && !types.includes(field.type ?? ""))
        add(`${path}/${name}`, `${name} 不适用于 ${field.type}`);
    if (field.type === "object" && !field.properties)
      add(`${path}/properties`, "object 必须声明 properties");
    if (field.pattern !== undefined)
      try {
        new RegExp(field.pattern, "u");
      } catch {
        add(`${path}/pattern`, "无效正则表达式");
      }
    if (field.enum && field.relation) add(`${path}/relation`, "enum 和 relation 不能同时声明");
    if (field.enum && field.type !== "array" && field.nullable !== undefined)
      add(`${path}/nullable`, "标量 enum 通过 null 成员决定空值，不再声明 nullable");
    if (field.storage?.column && field.storage.jsonKey)
      add(`${path}/storage`, "column 和 jsonKey 只能选择一个");
    if (field.relation) {
      for (const [key, fallback] of [
        ["valueField", "/id"],
        ["labelField", "/name"],
      ] as const)
        try {
          if (!pointerSegments(field.relation[key] ?? fallback).length) throw new Error();
        } catch {
          add(`${path}/relation/${key}`, "关系目标必须是非空 JSON Pointer");
        }
      const type =
        field.type === "array"
          ? (field.items?.type ??
            (
              { strings: "string", numbers: "number", booleans: "boolean" } as Record<
                string,
                string
              >
            )[field.format ?? ""])
          : field.type;
      if (!["string", "number", "integer", "boolean"].includes(type ?? ""))
        add(`${path}/relation`, "relation 只支持原子值或同类型原子值数组");
    }
    if (field.enum) {
      const type =
        field.type === "array"
          ? (field.items?.type ??
            (
              { strings: "string", numbers: "number", booleans: "boolean" } as Record<
                string,
                string
              >
            )[field.format ?? ""])
          : field.type;
      const values = new Set<string>();
      for (const [index, option] of enumOptions(field).entries()) {
        const value = option.value;
        const key = JSON.stringify(value);
        if (values.has(key)) add(`${path}/enum/${index}`, "enum 值不能重复");
        values.add(key);
        if (
          value === null
            ? field.type === "array"
            : type === "integer"
              ? typeof value !== "number" || !Number.isInteger(value)
              : typeof value !== type
        )
          add(`${path}/enum/${index}`, `enum 候选必须匹配 ${type}`);
      }
    }
    if (field.items?.enum) add(`${path}/items/enum`, "数组候选统一声明在字段 enum");
    if (
      options.allowUnknownFormats &&
      field.format &&
      !formats[field.format] &&
      !frameworkFormats[field.format]
    )
      formats[field.format] = { component: field.format, schema: baseFieldSchema };
    for (const [key, child] of Object.entries(field.properties ?? {}))
      walk(child, `${path}/properties/${escapePointer(key)}`, nextRefs);
    if (field.items) walk(field.items, `${path}/items`, nextRefs);
    if (field.additionalProperties)
      walk(field.additionalProperties, `${path}/additionalProperties`, nextRefs);
  };
  for (const [key, field] of Object.entries(document.data))
    walk(field, `/data/${escapePointer(key)}`);
  for (const [key, field] of Object.entries(document.$defs ?? {}))
    walk(field, `/$defs/${escapePointer(key)}`);
  if (issues.length) return issues;
  const checkResolved = (data: Record<string, FieldSchema>, prefix: string) => {
    const model = resolveModel({ ...document, data }, { ...options, formats });
    const checkDefaults = (pointer: string, path: string) => {
      const descriptor = model.field(pointer);
      const field = descriptor.schema;
      if (Object.hasOwn(field, "default"))
        for (const issue of [
          ...validateValue(descriptor.valueSchema, field.default),
          ...(field.default !== undefined && field.default !== null
            ? (descriptor.validateFormat?.(field.default) ?? [])
            : []),
        ])
          add(`${path}/default`, issue.message, "INVALID_DEFAULT");
      for (const [key, child] of Object.entries(field.properties ?? {}))
        if (child)
          checkDefaults(
            `${pointer}/${escapePointer(key)}`,
            `${path}/properties/${escapePointer(key)}`,
          );
      if (field.items) checkDefaults(`${pointer}/*`, `${path}/items`);
      if (field.additionalProperties) checkDefaults(`${pointer}/*`, `${path}/additionalProperties`);
    };
    for (const key of Object.keys(data))
      checkDefaults(`/${escapePointer(key)}`, `${prefix}/${escapePointer(key)}`);
    return model;
  };
  try {
    const model = checkResolved(document.data, "/data");
    if (document.tree) {
      for (const name of ["parentField", "labelField"] as const) {
        const pointer = document.tree[name];
        if (pointerSegments(pointer).length !== 1 || model.field(pointer).schema.type !== "string")
          add(`/tree/${name}`, "tree 字段必须是 string 根字段");
      }
      if (document.tree.parentField === document.tree.labelField)
        add("/tree/labelField", "名称字段不能与父级相同");
    }
  } catch (error) {
    if (error instanceof FormworkError && error.issues.length)
      for (const issue of error.issues) add(`/data${issue.path}`, issue.message, issue.code);
    else add("/data", error instanceof Error ? error.message : String(error));
  }
  for (const [key, field] of Object.entries(document.$defs ?? {}))
    try {
      checkResolved({ [key]: field }, "/$defs");
    } catch (error) {
      if (error instanceof FormworkError && error.issues.length)
        for (const issue of error.issues) add(`/$defs${issue.path}`, issue.message, issue.code);
      else
        add(`/$defs/${escapePointer(key)}`, error instanceof Error ? error.message : String(error));
    }
  return issues;
}

/** 为共享领域注册表创建严格的作者定义解析器。 */
export function createModelDefinitionSchema(
  contract: FieldContract = {},
): z.ZodType<ModelDefinition> {
  return definitionShape.superRefine((input, ctx) => {
    for (const issue of modelIssues(input, contract))
      ctx.addIssue({ code: "custom", path: pointerSegments(issue.path), message: issue.message });
  });
}
/** 校验传输字段结构；自定义 format 由加载后的 Domain 或服务端注册表校验。 */
export const modelDocumentSchema: z.ZodType<ModelDocument> = documentShape.superRefine(
  (input, ctx) => {
    for (const issue of modelIssues(input, { allowUnknownFormats: true }))
      ctx.addIssue({ code: "custom", path: pointerSegments(issue.path), message: issue.message });
  },
);
/** 使用 Framework 契约校验完整作者定义。 */
export const modelDefinitionSchema = createModelDefinitionSchema();
/** 校验领域加工后的 JSON Schema，代码 props 只允许在 RenderItem 调用处提供。 */
export function assertRuntimeSchema(input: unknown, contract: FieldContract = {}): RuntimeSchema {
  const issues = modelIssues(input, contract);
  if (issues.length) throw new FormworkError("INVALID_MODEL", "RuntimeSchema 校验失败", issues);
  return input as RuntimeSchema;
}
/** 仅校验草稿身份和 JSON 传输，不阻止保存暂时无效的字段定义。 */
export function assertDraftDefinition(input: unknown, modelId: string): DraftDefinition {
  if (!isObject(input) || input.id !== modelId)
    throw new FormworkError("INVALID_INPUT", "definition.id 必须匹配 modelId");
  try {
    return cloneJson(input as never) as DraftDefinition;
  } catch {
    throw new FormworkError("INVALID_INPUT", "definition 必须是可序列化的 JSON 对象");
  }
}
/** 校验当前账号的菜单快照。 */
export const modelNavigationSchema: z.ZodType<ModelNavigationSnapshot> = z
  .object({
    systemModels: z.array(z.object({ id: identity, title: z.string() }).strict()),
    pinnedModels: z.array(z.object({ id: identity, title: z.string() }).strict()),
    pinnableModelIds: z.array(identity),
  })
  .strict();
const issueSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
  modelId: z.string().optional(),
  router: z.string().optional(),
  window: z.string().optional(),
  source: z.object({ file: z.string(), line: z.number(), column: z.number() }).optional(),
});
/** 校验诊断报告的 HTTP envelope。 */
export const validationReportSchema = z
  .object({ errors: z.array(issueSchema), runtimeChecks: z.array(issueSchema) })
  .strict();
/** 校验管理目录的版本和操作权限。 */
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
const capabilitiesSchema = z
  .object({
    fields: z.record(
      z.string(),
      z
        .object({
          read: z.boolean(),
          create: z.boolean().optional(),
          update: z.boolean().optional(),
          filter: z.array(z.enum(["eq", "in", "contains", "between", "isNull", "isNotNull"])),
          sort: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
/** 验证管理快照，保留尚未通过发布校验的草稿。 */
export function assertManagedSnapshot(input: unknown, modelId: string): ManagedSnapshot {
  const parsed = managedEntrySchema
    .extend({
      definition: z.unknown(),
      baseVersion: z.number().int().positive().nullable(),
      diagnostics: validationReportSchema,
    })
    .parse(input);
  if (parsed.id !== modelId) throw new FormworkError("INVALID_MODEL", "快照 id 与请求不一致");
  return { ...parsed, definition: assertDraftDefinition(parsed.definition, modelId) };
}
/** 校验不可变发布版本中的作者定义。 */
export function assertPublishedSnapshot(input: unknown, modelId: string): PublishedSnapshot {
  const parsed = z
    .object({
      id: identity,
      version: z.number().int().positive(),
      revision: z.string().min(1),
      definition: definitionShape,
    })
    .strict()
    .parse(input);
  if (parsed.id !== modelId || parsed.definition.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "发布快照 id 与请求不一致");
  return parsed;
}
/** 校验与发布版本绑定的授权 Schema 和查询能力。 */
export function assertRuntimeSnapshot(input: unknown, modelId: string): RuntimeSnapshot {
  const parsed = z
    .object({
      schema: modelDocumentSchema,
      version: z.number().int().positive(),
      revision: z.string().min(1),
      capabilities: capabilitiesSchema,
    })
    .strict()
    .parse(input);
  if (parsed.schema.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "运行时 schema id 与请求不一致");
  return parsed;
}
/** 校验草稿预览，不伪造发布 version。 */
export function assertPreviewSnapshot(input: unknown, modelId: string): PreviewSnapshot {
  const parsed = z
    .object({
      schema: modelDocumentSchema,
      managementRevision: z.string().min(1),
      stage: z.enum(["draft", "published"]),
      baseVersion: z.number().int().positive().nullable(),
      capabilities: capabilitiesSchema,
    })
    .strict()
    .parse(input);
  if (parsed.schema.id !== modelId)
    throw new FormworkError("INVALID_MODEL", "预览 schema id 与请求不一致");
  return parsed;
}

/** 验证当前字段组件引用，页面布局不参与 Schema 校验。 */
export function fieldIssues(
  document: ModelDocument,
  components: readonly string[],
  contract: FieldContract = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const model = resolveModel(document, contract);
  const visit = (pointer: string) => {
    const field = model.field(pointer);
    for (const name of [
      field.component,
      ...Object.values(field.schema.ui ?? {}).flatMap((ui) =>
        ui && ui.component ? [ui.component] : [],
      ),
    ])
      if (!components.includes(name))
        issues.push({
          path: `/data${pointer}`,
          code: "UNKNOWN_COMPONENT",
          message: `未注册组件 ${name}`,
        });
    for (const key of Object.keys(field.schema.properties ?? {}))
      visit(`${pointer}/${escapePointer(key)}`);
    if (field.schema.items) visit(`${pointer}/*`);
  };
  for (const field of model.fields) visit(field.path);
  return issues;
}
