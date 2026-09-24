/** 服务端与表单运行时共同支持的声明式字段约束。 */
export interface ValueConstraintSchema {
  type?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

/** 单个声明式字段校验错误。 */
export interface ValueValidationIssue {
  readonly type:
    | "required"
    | "type"
    | "pattern"
    | "minLength"
    | "maxLength"
    | "minimum"
    | "maximum"
    | "minItems"
    | "maxItems";
  readonly message: string;
}

/** 必填语义统一将 `undefined`、`null`、空字符串和空数组视为空值。 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * 校验单个 Schema 节点的基础类型与声明式约束。
 *
 * 该函数不执行表达式或业务代码，可安全地同时用于浏览器和服务端。
 */
export function validateValueConstraints(
  schema: ValueConstraintSchema,
  value: unknown,
  options: { readonly required?: boolean; readonly label?: string } = {},
): ValueValidationIssue[] {
  const label = options.label ?? "字段";
  if (isEmptyValue(value)) {
    return options.required ? [{ type: "required", message: `${label} 必填` }] : [];
  }

  const issues: ValueValidationIssue[] = [];
  if (schema.type === "string") {
    if (typeof value !== "string") return [{ type: "type", message: `${label} 必须为字符串` }];
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      issues.push({ type: "pattern", message: `${label} 格式不合法` });
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ type: "minLength", message: `${label} 长度不能小于 ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({ type: "maxLength", message: `${label} 长度不能大于 ${schema.maxLength}` });
    }
    return issues;
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return [{ type: "type", message: `${label} 必须为数字` }];
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ type: "minimum", message: `${label} 不能小于 ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ type: "maximum", message: `${label} 不能大于 ${schema.maximum}` });
    }
    return issues;
  }

  if (schema.type === "boolean" && typeof value !== "boolean") {
    return [{ type: "type", message: `${label} 必须为布尔值` }];
  }
  if (
    schema.type === "object" &&
    (value === null || typeof value !== "object" || Array.isArray(value))
  ) {
    return [{ type: "type", message: `${label} 必须为对象` }];
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return [{ type: "type", message: `${label} 必须为数组` }];
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push({ type: "minItems", message: `${label} 至少需要 ${schema.minItems} 项` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      issues.push({ type: "maxItems", message: `${label} 最多允许 ${schema.maxItems} 项` });
    }
  }
  return issues;
}
