import type {
  FieldError,
  ObjectValidatorRule,
  RuntimeContext,
  SchemaRule,
  ValidatorRule,
} from "../schema";
import { executeRule } from "./rule";

/** 判定空值：undefined / null / "" / 空数组。 */
function isEmpty(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** 取「长度或数值」度量，用于 max / min：string/array 取 length，number 取值本身。 */
function measure(value: any): number | undefined {
  if (typeof value === "string" || Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  return undefined;
}

/** 判断一条规则是否为内置对象规则（含 required/max/min/pattern/message 之一）。 */
function isObjectRule(rule: ValidatorRule): rule is ObjectValidatorRule {
  return (
    typeof rule === "object" &&
    rule !== null &&
    !Array.isArray(rule) &&
    ("required" in rule ||
      "max" in rule ||
      "min" in rule ||
      "pattern" in rule ||
      "message" in rule)
  );
}

/**
 * 执行一条内置对象规则，依次检查 required / max / min / pattern。
 * 任一不过返回错误文案（优先 rule.message，否则内置默认文案）；全部通过返回 undefined。
 */
function runObjectRule(
  rule: ObjectValidatorRule,
  value: any,
): string | undefined {
  if (rule.required && isEmpty(value)) return rule.message ?? "此项为必填项";
  if (isEmpty(value)) return undefined; // 非必填空值跳过后续度量校验
  const m = measure(value);
  if (rule.max != null && m != null && m > rule.max)
    return rule.message ?? `不得大于 ${rule.max}`;
  if (rule.min != null && m != null && m < rule.min)
    return rule.message ?? `不得小于 ${rule.min}`;
  if (rule.pattern != null && !new RegExp(rule.pattern).test(String(value)))
    return rule.message ?? "格式不正确";
  return undefined;
}

/**
 * 执行一条 SchemaRule 校验（`@name`→handlers.validators / 表达式 / 函数，可 async）。
 * 返回 true / undefined 通过；返回 false / string 视为失败（string 即文案）。
 */
async function runSchemaRule(
  rule: SchemaRule,
  value: any,
  ctx: RuntimeContext,
): Promise<string | undefined> {
  const r = await executeRule(rule, ctx, "validators", value);
  if (r === true || r === undefined) return undefined;
  if (r === false) return "校验未通过";
  return String(r);
}

/**
 * 对单个字段按数组顺序执行全部 x-validators，收集所有错误（不短路）。
 * path 取字段当前路径，供 FieldError 定位。
 */
export async function runValidators(
  rules: ValidatorRule[],
  value: any,
  path: string,
  ctx: RuntimeContext,
): Promise<FieldError[]> {
  const errors: FieldError[] = [];
  for (const rule of rules) {
    const message = isObjectRule(rule)
      ? runObjectRule(rule, value)
      : await runSchemaRule(rule as SchemaRule, value, ctx);
    if (message) errors.push({ path, message });
  }
  return errors;
}

/**
 * 判断字段的 x-validators 是否包含 `required: true`（构建期用于点亮 field.required signal）。
 */
export function hasRequired(rules: ValidatorRule[] | undefined): boolean {
  return !!rules?.some((r) => isObjectRule(r) && r.required === true);
}
