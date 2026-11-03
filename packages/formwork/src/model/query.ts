import { enumOptions } from "./field";
import type {
  FieldSchema,
  DataSchema,
  JsonValue,
  QueryClause,
  QueryOperator,
  ValidationIssue,
} from "./types";
import { validateValue } from "./validation";

/** 按查询操作生成独立 operand 契约，不继承记录 required、default 和写入约束。 */
export function operandSchema(field: FieldSchema, operator: QueryOperator): DataSchema | undefined {
  if (operator === "isNull" || operator === "isNotNull") return undefined;
  if (operator === "contains") return { type: "string" };
  const scalar = {
    type: field.type === "array" ? field.items?.type : field.type,
    ...(field.enum
      ? {
          enum: enumOptions(field)
            .filter((option) => option.value !== null)
            .map((option) => option.value),
        }
      : {}),
  } as DataSchema;
  if (operator === "between")
    return { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 };
  if (operator === "in") return { type: "array", items: scalar, minItems: 1, uniqueItems: true };
  return scalar;
}
/** 从后端允许的操作中选择文本搜索或精确匹配默认项。 */
export function defaultOperator(
  field: FieldSchema,
  allowed: readonly QueryOperator[],
): QueryOperator {
  return (
    (field.type === "string" && !field.enum && !field.relation && allowed.includes("contains")
      ? "contains"
      : allowed.includes("eq")
        ? "eq"
        : allowed[0]) ?? "eq"
  );
}
/** 验证单个查询条件，清空条件与匹配 null 使用不同协议。 */
export function queryClauseIssues(
  field: FieldSchema,
  allowed: readonly QueryOperator[],
  clause: QueryClause,
): ValidationIssue[] {
  if (!allowed.includes(clause.operator))
    return [
      { path: clause.field, code: "UNSUPPORTED_OPERATOR", message: `不支持 ${clause.operator}` },
    ];
  const schema = operandSchema(field, clause.operator);
  if (!schema)
    return clause.operand === undefined
      ? []
      : [{ path: clause.field, code: "INVALID_OPERAND", message: "空值操作不能携带 operand" }];
  if (clause.operand === undefined)
    return [{ path: clause.field, code: "OPERAND_REQUIRED", message: "请填写查询值" }];
  const issues = validateValue(schema, clause.operand).map((issue) => ({
    ...issue,
    path: clause.field + issue.path,
  }));
  if (
    clause.operator === "between" &&
    Array.isArray(clause.operand) &&
    Number(clause.operand[0]) > Number(clause.operand[1])
  )
    issues.push({ path: clause.field, code: "INVALID_RANGE", message: "范围起点不能大于终点" });
  return issues;
}

/** 为选择 null 的控件生成无 operand 的空值条件。 */
export function normalizeClause(
  field: string,
  operator: QueryOperator,
  operand?: JsonValue,
): QueryClause {
  return operand === null && operator === "eq"
    ? { field, operator: "isNull" }
    : {
        field,
        operator,
        ...(operator === "isNull" || operator === "isNotNull" ? {} : { operand }),
      };
}
