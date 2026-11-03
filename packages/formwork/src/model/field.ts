import { z } from "zod";
import { FormworkError } from "./errors";
import { escapePointer, pointerSegments, isObject } from "./pointer";
import type {
  DataSchema,
  EnumOption,
  FieldCapabilities,
  FieldSchema,
  JsonValue,
  ModelDocument,
  ObjectSchema,
  RecordCapabilities,
  Scene,
  ValidationIssue,
} from "./types";

/** 禁止字段 props 伪造 renderer 提供的绑定、候选源和权限。 */
export const controlledProps = new Set([
  "value",
  "onChange",
  "scene",
  "field",
  "readOnly",
  "disabled",
  "errors",
  "schema",
  "array",
  "Item",
  "ValueItem",
  "Detail",
  "children",
  "options",
  "relation",
  "multiple",
  "binding",
  "record",
  "operator",
  "operandSchema",
]);
const json = z.json();
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const propsSchema = z
  .object({
    placeholder: z.string().optional(),
    clearable: z.boolean().optional(),
    maxTagCount: z.number().int().nonnegative().optional(),
    maxWidth: z.number().positive().optional(),
    minHeight: z.number().nonnegative().optional(),
    maxLines: z.number().int().positive().optional(),
    labelWidth: z.number().nonnegative().optional(),
    help: z.string().optional(),
  })
  .catchall(json)
  .superRefine((props, ctx) => {
    for (const key of Object.keys(props))
      if (controlledProps.has(key))
        ctx.addIssue({ code: "custom", path: [key], message: `props 不能覆盖受控属性 ${key}` });
  });
const presentation = z.union([
  z.literal(false),
  z
    .object({
      component: z.string().min(1).optional(),
      props: propsSchema.optional(),
    })
    .strict(),
]);
/** 校验递归字段的协议形状，保留组件所需的扩展 JSON props。 */
export const baseFieldSchema: z.ZodType<FieldSchema> = z.lazy(() =>
  z
    .object({
      type: z
        .enum(["string", "number", "integer", "boolean", "object", "array", "null"])
        .optional(),
      $ref: z.string().optional(),
      id: z.string().min(1).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: json.optional(),
      required: z.boolean().optional(),
      readOnly: z.boolean().optional(),
      nullable: z.boolean().optional(),
      format: z.string().min(1).optional(),
      enum: z
        .array(z.union([scalar, z.object({ value: scalar, label: z.string() }).strict()]))
        .nonempty()
        .optional(),
      relation: z
        .object({
          model: z.string().regex(/^[a-z][a-z0-9_-]*$/u),
          valueField: z.string().optional(),
          labelField: z.string().optional(),
        })
        .strict()
        .optional(),
      props: propsSchema.optional(),
      ui: z
        .object({
          form: presentation.optional(),
          filter: presentation.optional(),
          table: presentation.optional(),
          detail: presentation.optional(),
        })
        .strict()
        .optional(),
      query: z
        .object({ filter: z.literal(false).optional(), sort: z.literal(false).optional() })
        .strict()
        .optional(),
      storage: z
        .object({
          column: z
            .string()
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u)
            .optional(),
          jsonKey: z.string().min(1).optional(),
          index: z.enum(["index", "unique"]).optional(),
          through: z
            .string()
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u)
            .optional(),
        })
        .strict()
        .optional(),
      properties: z.record(z.string(), baseFieldSchema).optional(),
      items: baseFieldSchema.optional(),
      additionalProperties: z.union([z.literal(false), baseFieldSchema]).optional(),
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().nonnegative().optional(),
      pattern: z.string().optional(),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
      minItems: z.number().int().nonnegative().optional(),
      maxItems: z.number().int().nonnegative().optional(),
    })
    .strict(),
);

/** 声明前后端共享的 format 值契约；视觉映射属于 app.ui。 */
export type FormatDefinition = {
  schema: z.ZodType<FieldSchema>;
  normalize?: (field: FieldSchema) => FieldSchema;
  valueSchema?: z.ZodType<JsonValue>;
  props?: Record<string, JsonValue>;
};
/** 按名称共享字段预设，前后端使用同一注册表。 */
export type FormatRegistry = Readonly<Record<string, FormatDefinition>>;
/** 允许领域共享字段预设和纯函数默认推导。 */
export type FieldContract = {
  formats?: FormatRegistry;
  inferFormat?: (field: FieldSchema) => string | undefined;
};
const primitive = new Set(["string", "number", "integer", "boolean", "null"]);
const typed = (types: readonly string[]) =>
  baseFieldSchema.refine((field) => types.includes(field.type ?? ""), {
    path: ["type"],
    message: `format 需要 ${types.join("/")} 类型`,
  });
function plural(type: "string" | "number" | "boolean"): FormatDefinition {
  return {
    normalize: (field) => ({ ...field, items: field.items ?? { type } }),
    schema: typed(["array"]).refine(
      (field) =>
        field.items?.type === type || (type === "number" && field.items?.type === "integer"),
      {
        path: ["items", "type"],
        message: `多选项必须是 ${type}${type === "number" ? "/integer" : ""}`,
      },
    ),
  };
}
/** 提供 Framework 默认格式；复杂数组仍保持逐项数据递归。 */
export const frameworkFormats: FormatRegistry = {
  input: { schema: typed(["string"]) },
  text: { schema: typed(["string"]) },
  number: { schema: typed(["number", "integer"]) },
  boolean: { schema: typed(["boolean"]) },
  null: { schema: typed(["null"]) },
  object: { schema: typed(["object"]) },
  array: { schema: typed(["array"]) },
  strings: plural("string"),
  numbers: plural("number"),
  booleans: plural("boolean"),
  select: {
    schema: baseFieldSchema.superRefine((field, ctx) => {
      if (Number(!!field.enum) + Number(!!field.relation) !== 1)
        ctx.addIssue({
          code: "custom",
          path: ["format"],
          message: "select 必须且只能配置 enum 或 relation",
        });
      if (
        !primitive.has(field.type ?? "") &&
        !(
          field.type === "array" &&
          primitive.has(field.items?.type ?? "") &&
          field.items?.type !== "null"
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["type"],
          message: "select 只支持原子值或原子值数组",
        });
    }),
  },
};

/** 按原始值生成标签，不将 false、0、空串和 null 当作缺失。 */
export function enumOptions(field: FieldSchema): EnumOption[] {
  return (field.enum ?? []).map((item) =>
    typeof item === "object" && item !== null
      ? item
      : { value: item, label: item === null ? "空值" : String(item) },
  );
}
/** 从 type、候选源及数组项形态推导默认格式。 */
export function inferFormat(field: FieldSchema): string {
  if (field.type === "array")
    return (
      (
        { string: "strings", integer: "numbers", number: "numbers", boolean: "booleans" } as Record<
          string,
          string
        >
      )[field.items?.type ?? ""] ?? "array"
    );
  if (field.enum || field.relation) return "select";
  return (
    (
      {
        string: "input",
        integer: "number",
        number: "number",
        boolean: "boolean",
        object: "object",
        null: "null",
      } as Record<string, string>
    )[field.type ?? ""] ?? ""
  );
}
/** 展开本地引用，引用处只允许元信息覆盖，不更改复用值结构。 */
export function resolveFieldSchema(field: FieldSchema, document: ModelDocument): FieldSchema {
  const seen = new Set<string>();
  while (field.$ref) {
    const ref = field.$ref;
    if (seen.has(ref)) throw new FormworkError("INVALID_MODEL", `循环引用 ${ref}`);
    seen.add(ref);
    const parts = pointerSegments(ref.startsWith("#") ? ref.slice(1) : ref);
    const target = document.$defs?.[parts[1] ?? ""];
    if (!ref.startsWith("#/$defs/") || parts.length !== 2 || !target)
      throw new FormworkError("INVALID_MODEL", `不存在的本地引用 ${ref}`);
    const { $ref: _ref, ...metadata } = field;
    field = { ...target, ...metadata, readOnly: !!target.readOnly || !!metadata.readOnly };
  }
  return field;
}
/** 持有可以在多个记录和场景间复用的无状态字段描述。 */
export type FieldDescriptor = {
  path: string;
  schema: FieldSchema;
  valueSchema: DataSchema;
  format: string;
  props: Record<string, JsonValue>;
  options: readonly EnumOption[];
  capabilities?: FieldCapabilities;
  validateFormat?: (value: JsonValue) => readonly ValidationIssue[];
};
/** 保存编译后的值校验根及字段索引，不包含当前记录值。 */
export type ResolvedModel = {
  schema: ModelDocument;
  valueSchema: ObjectSchema;
  fields: readonly FieldDescriptor[];
  field: (pointer: string) => FieldDescriptor;
  validateFormats: (value: JsonValue | undefined) => ValidationIssue[];
};

/** 编译字段协议为内部值 Schema 和无状态描述，默认值不会写回作者原文。 */
export function resolveModel(
  document: ModelDocument,
  contract: FieldContract = {},
  capabilities?: RecordCapabilities,
): ResolvedModel {
  const formats = { ...frameworkFormats, ...contract.formats };
  const descriptors = new Map<string, FieldDescriptor>();
  const compile = (source: FieldSchema, path: string, refs = new Set<string>()): DataSchema => {
    if (source.$ref && refs.has(source.$ref))
      throw new FormworkError("INVALID_MODEL", `循环引用 ${source.$ref}`);
    const nextRefs = new Set(refs);
    if (source.$ref) nextRefs.add(source.$ref);
    let field = resolveFieldSchema(source, document);
    const format = field.format ?? contract.inferFormat?.(field) ?? inferFormat(field);
    const preset = formats[format];
    if (!preset)
      throw new FormworkError("UNKNOWN_FORMAT", `未注册 format ${format}`, [
        { path, code: "UNKNOWN_FORMAT", message: `未注册 format ${format}` },
      ]);
    field = preset.normalize?.(field) ?? field;
    const parsed = preset.schema.safeParse(field, { jitless: true });
    if (!parsed.success)
      throw new FormworkError(
        "INVALID_FORMAT",
        `字段 ${path} 不满足 ${format}`,
        parsed.error.issues.map((issue) => ({
          path: `${path}/${issue.path.map((part) => escapePointer(String(part))).join("/")}`,
          code: "INVALID_FORMAT",
          message: issue.message,
        })),
      );
    const options = enumOptions(field);
    const nullable =
      field.type !== "array" && field.enum
        ? options.some((option) => option.value === null)
        : field.nullable;
    const value: Record<string, unknown> = {
      type: nullable && field.type !== "null" ? [field.type, "null"] : field.type,
    };
    for (const key of [
      "title",
      "description",
      "default",
      "readOnly",
      "minLength",
      "maxLength",
      "pattern",
      "minimum",
      "maximum",
      "minItems",
      "maxItems",
    ] as const)
      if (field[key] !== undefined) value[key] = field[key];
    if (field.type === "object") {
      value.properties = Object.fromEntries(
        Object.entries(field.properties ?? {}).map(([key, child]) => [
          key,
          compile(child, `${path}/${escapePointer(key)}`, nextRefs),
        ]),
      );
      value.required = Object.entries(field.properties ?? {})
        .filter(([, child]) => resolveFieldSchema(child, document).required)
        .map(([key]) => key);
      value.additionalProperties = field.additionalProperties
        ? compile(field.additionalProperties, `${path}/*`, nextRefs)
        : false;
    } else if (field.type === "array") {
      if (!field.items) throw new FormworkError("INVALID_MODEL", `数组 ${path} 缺少 items`);
      value.items = {
        ...compile(field.items, `${path}/*`, nextRefs),
        ...(field.enum ? { enum: options.map((option) => option.value) } : {}),
      };
      if (["strings", "numbers", "booleans", "select"].includes(format) || field.relation)
        value.uniqueItems = true;
    } else if (field.enum) value.enum = options.map((option) => option.value);
    const valueSchema = value as DataSchema;
    descriptors.set(path, {
      path,
      schema: field,
      valueSchema,
      format,
      props: { ...preset.props, ...field.props },
      options,
      capabilities: capabilities?.fields[path],
      ...(preset.valueSchema
        ? {
            validateFormat: (value: JsonValue) => {
              const result = preset.valueSchema!.safeParse(value, { jitless: true });
              return result.success
                ? []
                : result.error.issues.map((issue) => ({
                    path: issue.path.length
                      ? `/${issue.path.map((part) => escapePointer(String(part))).join("/")}`
                      : "",
                    code: "INVALID_FORMAT_VALUE",
                    message: issue.message,
                  }));
            },
          }
        : {}),
    });
    return valueSchema;
  };
  const valueSchema: ObjectSchema = {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(document.data).map(([key, field]) => [
        key,
        compile(field, `/${escapePointer(key)}`),
      ]),
    ),
    required: Object.entries(document.data)
      .filter(([, field]) => resolveFieldSchema(field, document).required)
      .map(([key]) => key),
    additionalProperties: false,
  };
  return {
    schema: document,
    valueSchema,
    fields: Object.keys(document.data).map((key) => descriptors.get(`/${escapePointer(key)}`)!),
    field(pointer) {
      const segments = pointerSegments(pointer);
      let field: FieldSchema = { type: "object", properties: document.data };
      const canonical: string[] = [];
      for (const segment of segments) {
        field = resolveFieldSchema(field, document);
        if (field.type === "array") {
          canonical.push("*");
          field = descriptors.get(`/${canonical.join("/")}`)?.schema ?? field.items!;
        } else {
          const declared =
            field.properties && Object.hasOwn(field.properties, segment)
              ? field.properties[segment]
              : undefined;
          const child = declared ?? field.additionalProperties;
          if (!child) throw new FormworkError("UNKNOWN_FIELD", `未知字段 ${pointer}`);
          canonical.push(declared ? escapePointer(segment) : "*");
          field = child;
        }
        if (!field) throw new FormworkError("UNKNOWN_FIELD", `未知字段 ${pointer}`);
      }
      const descriptor = descriptors.get(`/${canonical.join("/")}`);
      if (!descriptor) throw new FormworkError("UNKNOWN_FIELD", `未知字段 ${pointer}`);
      return descriptor;
    },
    validateFormats(value) {
      const issues: ValidationIssue[] = [];
      const visit = (value: JsonValue | undefined, path: string, canonical: string) => {
        if (value === undefined || value === null) return;
        const field = descriptors.get(canonical);
        if (field?.validateFormat)
          issues.push(
            ...field.validateFormat(value).map((issue) => ({ ...issue, path: path + issue.path })),
          );
        if (Array.isArray(value))
          value.forEach((child, index) => visit(child, `${path}/${index}`, `${canonical}/*`));
        else if (isObject(value))
          for (const [key, child] of Object.entries(value))
            visit(
              child as JsonValue,
              `${path}/${escapePointer(key)}`,
              descriptors.has(`${canonical}/${escapePointer(key)}`)
                ? `${canonical}/${escapePointer(key)}`
                : `${canonical}/*`,
            );
      };
      visit(value, "", "");
      return issues;
    },
  };
}

/** 根据场景与本次覆盖解析组件名，保留字段共享 props。 */
export function resolveField(
  field: FieldDescriptor,
  options: { scene: Scene; component?: string; props?: Record<string, unknown> },
): { component: string; props: Record<string, unknown> } {
  const presentation = field.schema.ui?.[options.scene];
  const component = options.component ?? (presentation ? presentation.component : undefined);
  if (!component)
    throw new FormworkError("MISSING_UI", `字段 ${field.path} 缺少 ${options.scene} 组件映射`);
  return {
    component,
    props: { ...field.props, ...(presentation ? presentation.props : {}), ...options.props },
  };
}
