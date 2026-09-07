import { AppError } from "../errors.ts";
import type { FieldPlan } from "./field-plan.ts";

type Scalar = string | number | boolean | null;

type Operand =
  | { kind: "field"; name: string }
  | { kind: "auth"; property: "id" }
  | { kind: "literal"; value: Scalar };

type FilterExpression =
  | { kind: "comparison"; left: Operand; operator: FilterOperator; right: Operand }
  | { kind: "logical"; operator: "AND" | "OR"; left: FilterExpression; right: FilterExpression };

type FilterOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "~" | "!~";

export interface RecordFilterContext {
  authId: string;
  fields: Map<string, FieldPlan>;
}

export interface CompiledRecordFilter {
  sql: string;
  args: Array<string | number>;
}

interface Token {
  type: "identifier" | "literal" | "operator" | "leftParen" | "rightParen" | "and" | "or" | "eof";
  value?: string | number | boolean | null;
  offset: number;
}

const systemFields = new Map<string, FieldPlan>([
  ["id", { field: "id", type: "text", json: false, filterable: true, sortable: true }],
  [
    "createdAt",
    { field: "createdAt", type: "integer", json: false, filterable: true, sortable: true },
  ],
  [
    "updatedAt",
    { field: "updatedAt", type: "integer", json: false, filterable: true, sortable: true },
  ],
]);

function invalid(message: string): never {
  throw new AppError(`filter 表达式无效：${message}`, 400);
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_@]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_.@]/.test(char);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "leftParen", offset: index++ });
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rightParen", offset: index++ });
      continue;
    }
    if (input.startsWith("&&", index)) {
      tokens.push({ type: "and", offset: index });
      index += 2;
      continue;
    }
    if (input.startsWith("||", index)) {
      tokens.push({ type: "or", offset: index });
      index += 2;
      continue;
    }
    const operator = ["!=", ">=", "<=", "!~", "=", ">", "<", "~"].find((item) =>
      input.startsWith(item, index),
    );
    if (operator) {
      tokens.push({ type: "operator", value: operator, offset: index });
      index += operator.length;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      const start = index++;
      let value = "";
      let closed = false;
      while (index < input.length) {
        const next = input[index++];
        if (next === quote) {
          closed = true;
          break;
        }
        if (next === "\\") {
          const escaped = input[index++];
          if (escaped === undefined) invalid(`位置 ${index} 的转义字符不完整`);
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
        } else {
          value += next;
        }
      }
      if (!closed) invalid(`位置 ${start} 的字符串没有结束引号`);
      tokens.push({ type: "literal", value, offset: start });
      continue;
    }
    if (char === "-" || /\d/.test(char)) {
      const start = index;
      const matched = input.slice(index).match(/^-?(?:\d+\.?\d*|\.\d+)/)?.[0];
      if (!matched) invalid(`位置 ${start} 的数字格式不正确`);
      const value = Number(matched);
      if (!Number.isFinite(value)) invalid(`位置 ${start} 的数字超出范围`);
      tokens.push({ type: "literal", value, offset: start });
      index += matched.length;
      continue;
    }
    if (isIdentifierStart(char)) {
      const start = index;
      index += 1;
      while (index < input.length && isIdentifierPart(input[index])) index += 1;
      const value = input.slice(start, index);
      if (value === "true" || value === "false") {
        tokens.push({ type: "literal", value: value === "true", offset: start });
      } else if (value === "null") {
        tokens.push({ type: "literal", value: null, offset: start });
      } else {
        tokens.push({ type: "identifier", value, offset: start });
      }
      continue;
    }
    invalid(`位置 ${index} 存在不支持的字符 "${char}"`);
  }
  tokens.push({ type: "eof", offset: input.length });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FilterExpression {
    const expression = this.parseOr();
    if (this.current().type !== "eof") invalid(`位置 ${this.current().offset} 后存在多余内容`);
    return expression;
  }

  private parseOr(): FilterExpression {
    let expression = this.parseAnd();
    while (this.match("or")) {
      expression = { kind: "logical", operator: "OR", left: expression, right: this.parseAnd() };
    }
    return expression;
  }

  private parseAnd(): FilterExpression {
    let expression = this.parsePrimary();
    while (this.match("and")) {
      expression = {
        kind: "logical",
        operator: "AND",
        left: expression,
        right: this.parsePrimary(),
      };
    }
    return expression;
  }

  private parsePrimary(): FilterExpression {
    if (this.match("leftParen")) {
      const expression = this.parseOr();
      this.expect("rightParen", "缺少右括号");
      return expression;
    }
    const left = this.parseOperand();
    const token = this.expect("operator", "比较表达式缺少操作符");
    const right = this.parseOperand();
    return {
      kind: "comparison",
      left,
      operator: token.value as FilterOperator,
      right,
    };
  }

  private parseOperand(): Operand {
    const token = this.current();
    if (token.type === "literal") {
      this.index += 1;
      return { kind: "literal", value: token.value as Scalar };
    }
    if (token.type === "identifier") {
      this.index += 1;
      if (token.value === "@request.auth.id") return { kind: "auth", property: "id" };
      if (String(token.value).startsWith("@")) {
        invalid(`位置 ${token.offset} 的上下文变量不受支持`);
      }
      return { kind: "field", name: String(token.value) };
    }
    invalid(`位置 ${token.offset} 需要字段、@request.auth.id 或字面量`);
  }

  private current(): Token {
    return this.tokens[this.index];
  }

  private match(type: Token["type"]): boolean {
    if (this.current().type !== type) return false;
    this.index += 1;
    return true;
  }

  private expect(type: Token["type"], message: string): Token {
    const token = this.current();
    if (token.type !== type) invalid(`位置 ${token.offset} ${message}`);
    this.index += 1;
    return token;
  }
}

function fieldPlan(name: string, context: RecordFilterContext): FieldPlan {
  const plan = context.fields.get(name) ?? systemFields.get(name);
  if (!plan || !plan.filterable) invalid(`字段 "${name}" 不允许筛选`);
  return plan;
}

function fieldExpr(field: string): string {
  if (field === "id") return `"id"`;
  if (field === "createdAt") return `"created_at"`;
  if (field === "updatedAt") return `"updated_at"`;
  return `json_extract(data_content, '$.${field}')`;
}

function scalarValue(operand: Operand, context: RecordFilterContext): Scalar {
  if (operand.kind === "literal") return operand.value;
  if (operand.kind === "auth") return context.authId;
  invalid(`字段 "${operand.name}" 只能作为比较表达式左侧`);
}

function encodeValue(plan: FieldPlan, value: Scalar): string | number {
  if (value === null) invalid(`字段 "${plan.field}" 的 null 只能配合 = 或 !=`);
  if (plan.type === "boolean") {
    if (typeof value !== "boolean") invalid(`字段 "${plan.field}" 只能与布尔值比较`);
    return value ? 1 : 0;
  }
  if (plan.type === "integer" || plan.type === "real") {
    if (typeof value !== "number") invalid(`字段 "${plan.field}" 只能与数字比较`);
    return value;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    invalid(`字段 "${plan.field}" 只能与字符串或数字比较`);
  }
  return value;
}

function compileComparison(
  expression: Extract<FilterExpression, { kind: "comparison" }>,
  context: RecordFilterContext,
): CompiledRecordFilter {
  if (expression.left.kind !== "field") invalid("比较表达式左侧必须是模型字段");
  const plan = fieldPlan(expression.left.name, context);
  const value = scalarValue(expression.right, context);
  const sql = fieldExpr(plan.field);

  if (value === null) {
    if (expression.operator === "=") return { sql: `${sql} IS NULL`, args: [] };
    if (expression.operator === "!=") return { sql: `${sql} IS NOT NULL`, args: [] };
    invalid("null 只支持 = 或 != 比较");
  }
  if ((expression.operator === "~" || expression.operator === "!~") && plan.type !== "text") {
    invalid(`字段 "${plan.field}" 仅文本字段支持 ~ 或 !~`);
  }
  const operator =
    expression.operator === "~"
      ? "LIKE"
      : expression.operator === "!~"
        ? "NOT LIKE"
        : expression.operator;
  const encoded = encodeValue(plan, value);
  return {
    sql: `${sql} ${operator} ?`,
    args: [expression.operator === "~" || expression.operator === "!~" ? `%${encoded}%` : encoded],
  };
}

function compile(expression: FilterExpression, context: RecordFilterContext): CompiledRecordFilter {
  if (expression.kind === "comparison") return compileComparison(expression, context);
  const left = compile(expression.left, context);
  const right = compile(expression.right, context);
  return {
    sql: `(${left.sql} ${expression.operator} ${right.sql})`,
    args: [...left.args, ...right.args],
  };
}

/** 将受限 PocketBase 风格 filter 编译为参数化 SQL；绝不接受原始 SQL。 */
export function compileRecordFilter(
  filter: string | undefined,
  context: RecordFilterContext,
): CompiledRecordFilter | undefined {
  const source = filter?.trim();
  if (!source) return undefined;
  return compile(new Parser(tokenize(source)).parse(), context);
}
