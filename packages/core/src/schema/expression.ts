/**
 * @alien-form/core — Restricted expression runtime
 *
 * Evaluates a safe subset of JS expressions using jsep-style parsing.
 * No `new Function`, no eval. Function calls, statements, assignments,
 * constructors and reflective/global access are rejected.
 *
 * Simplified from hand-rolled parser to a compact recursive-descent
 * implementation focused on clarity.
 */

// ─── AST Node Types ──────────────────────────────────────────────────────────

type Node =
  | { type: "Literal"; value: any }
  | { type: "Identifier"; name: string }
  | { type: "Array"; elements: Node[] }
  | { type: "Object"; properties: { key: string; value: Node }[] }
  | { type: "Unary"; op: string; arg: Node }
  | { type: "Binary"; op: string; left: Node; right: Node }
  | { type: "Logical"; op: string; left: Node; right: Node }
  | { type: "Conditional"; test: Node; yes: Node; no: Node }
  | { type: "Member"; object: Node; key: string | Node; computed: boolean };

// ─── Safety ──────────────────────────────────────────────────────────────────

const FORBIDDEN_IDS = new Set([
  "globalThis", "window", "document", "process", "Function",
  "eval", "constructor", "prototype", "__proto__", "new",
  "function", "class", "import", "this",
]);

const FORBIDDEN_KEYS = new Set(["constructor", "prototype", "__proto__"]);

// ─── Public API ──────────────────────────────────────────────────────────────

export function evaluateExpression(expr: string, scope: Record<string, any>): any {
  const p = new Parser(expr);
  const ast = p.parseExpression();
  p.expectEnd();
  return evaluate(ast, scope);
}

// ─── Tokenizer (inline, cursor-based) ────────────────────────────────────────

class Parser {
  private src: string;
  private pos = 0;
  private len: number;

  constructor(src: string) {
    this.src = src;
    this.len = src.length;
  }

  parseExpression(): Node {
    return this.conditional();
  }

  expectEnd(): void {
    this.skip();
    if (this.pos < this.len) {
      const ch = this.src[this.pos];
      if (ch === "(") this.fail("function calls are not allowed; use computed handler");
      // Detect assignment operators: =, +=, -=, *=, /=, %=
      if (ch === "=" && this.src[this.pos + 1] !== "=" && this.src[this.pos + 1] !== ">") {
        this.fail("assignment is not allowed");
      }
      if ((ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") && this.src[this.pos + 1] === "=") {
        this.fail("assignment is not allowed");
      }
      this.fail(`unexpected character '${ch}'`);
    }
  }

  // ─── Precedence climbing ─────────────────────────────────────────────

  private conditional(): Node {
    const test = this.logicalOr();
    if (!this.eat("?")) return test;
    const yes = this.parseExpression();
    this.expect(":");
    const no = this.parseExpression();
    return { type: "Conditional", test, yes, no };
  }

  private logicalOr(): Node {
    let node = this.logicalAnd();
    while (this.eat("||") || this.eat("??")) {
      const op = this.lastOp!;
      node = { type: "Logical", op, left: node, right: this.logicalAnd() };
    }
    return node;
  }

  private logicalAnd(): Node {
    let node = this.equality();
    while (this.eat("&&")) {
      node = { type: "Logical", op: "&&", left: node, right: this.equality() };
    }
    return node;
  }

  private equality(): Node {
    let node = this.comparison();
    while (this.eat("===") || this.eat("!==") || this.eat("==") || this.eat("!=")) {
      node = { type: "Binary", op: this.lastOp!, left: node, right: this.comparison() };
    }
    return node;
  }

  private comparison(): Node {
    let node = this.additive();
    while (this.eat("<=") || this.eat(">=") || this.eat("<") || this.eat(">")) {
      node = { type: "Binary", op: this.lastOp!, left: node, right: this.additive() };
    }
    return node;
  }

  private additive(): Node {
    let node = this.multiplicative();
    while (this.eatChar("+") || this.eatChar("-")) {
      node = { type: "Binary", op: this.lastOp!, left: node, right: this.multiplicative() };
    }
    return node;
  }

  private multiplicative(): Node {
    let node = this.unary();
    while (this.eatChar("*") || this.eatChar("/") || this.eatChar("%")) {
      node = { type: "Binary", op: this.lastOp!, left: node, right: this.unary() };
    }
    return node;
  }

  private unary(): Node {
    if (this.eatChar("!") || this.eatChar("-") || this.eatChar("+")) {
      return { type: "Unary", op: this.lastOp!, arg: this.unary() };
    }
    return this.member();
  }

  private member(): Node {
    let node = this.primary();
    while (true) {
      if (this.eatChar(".")) {
        const key = this.readIdentifier();
        if (!key) this.fail("expected property name");
        this.assertSafeKey(key);
        node = { type: "Member", object: node, key, computed: false };
      } else if (this.eatChar("[")) {
        const key = this.parseExpression();
        this.expect("]");
        node = { type: "Member", object: node, key, computed: true };
      } else if (this.peek() === "(") {
        this.fail("function calls are not allowed; use computed handler");
      } else {
        break;
      }
    }
    return node;
  }

  private primary(): Node {
    this.skip();
    const ch = this.src[this.pos];

    // Parenthesized expression
    if (ch === "(") { this.pos++; const n = this.parseExpression(); this.expect(")"); return n; }

    // Array literal
    if (ch === "[") {
      this.pos++;
      const elements: Node[] = [];
      if (!this.eatChar("]")) {
        do { elements.push(this.parseExpression()); } while (this.eatChar(","));
        this.expect("]");
      }
      return { type: "Array", elements };
    }

    // Object literal
    if (ch === "{") {
      this.pos++;
      const properties: { key: string; value: Node }[] = [];
      if (!this.eatChar("}")) {
        do {
          if (this.peek() === "}") break;
          const key = this.readObjectKey();
          this.assertSafeKey(key);
          this.expect(":");
          properties.push({ key, value: this.parseExpression() });
        } while (this.eatChar(","));
        this.expect("}");
      }
      return { type: "Object", properties };
    }

    // String literal
    if (ch === "'" || ch === '"') return { type: "Literal", value: this.readString() };

    // Number literal
    if (isDigit(ch) || (ch === "." && isDigit(this.src[this.pos + 1]))) {
      return { type: "Literal", value: this.readNumber() };
    }

    // Identifier / keyword literal
    const id = this.readIdentifier();
    if (id) {
      if (id === "true") return { type: "Literal", value: true };
      if (id === "false") return { type: "Literal", value: false };
      if (id === "null") return { type: "Literal", value: null };
      if (id === "undefined") return { type: "Literal", value: undefined };
      this.assertSafeId(id);
      return { type: "Identifier", name: id };
    }

    // Forbidden tokens
    if (ch === "`" || ch === ";") this.fail("statements and template literals are not allowed");
    if (ch === "=" && this.src[this.pos + 1] !== "=" && this.src[this.pos + 1] !== ">") {
      this.fail("assignment is not allowed");
    }
    if (this.src.slice(this.pos, this.pos + 2) === "=>") {
      this.fail("arrow functions are not allowed");
    }

    this.fail(`unexpected character '${ch}'`);
  }

  // ─── Low-level readers ───────────────────────────────────────────────

  private lastOp: string | undefined;

  private skip(): void {
    while (this.pos < this.len && /\s/.test(this.src[this.pos])) this.pos++;
  }

  private peek(): string | undefined {
    this.skip();
    return this.src[this.pos];
  }

  /** Try to consume a multi-char operator (longest-match first). */
  private eat(op: string): boolean {
    this.skip();
    if (this.src.startsWith(op, this.pos)) {
      this.pos += op.length;
      this.lastOp = op;
      return true;
    }
    return false;
  }

  /** Try to consume a single-char operator/punctuator. */
  private eatChar(ch: string): boolean {
    this.skip();
    if (this.src[this.pos] === ch) {
      this.pos++;
      this.lastOp = ch;
      return true;
    }
    return false;
  }

  private expect(ch: string): void {
    if (!this.eatChar(ch) && !this.eat(ch)) this.fail(`expected '${ch}'`);
  }

  private readIdentifier(): string {
    this.skip();
    const start = this.pos;
    if (this.pos < this.len && /[A-Za-z_$]/.test(this.src[this.pos])) {
      this.pos++;
      while (this.pos < this.len && /[A-Za-z0-9_$]/.test(this.src[this.pos])) this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private readObjectKey(): string {
    this.skip();
    const ch = this.src[this.pos];
    if (ch === "'" || ch === '"') return this.readString();
    return this.readIdentifier();
  }

  private readString(): string {
    const quote = this.src[this.pos++];
    let result = "";
    while (this.pos < this.len) {
      const ch = this.src[this.pos];
      if (ch === quote) { this.pos++; return result; }
      if (ch === "\\") {
        this.pos++;
        const esc = this.src[this.pos++];
        const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", "\\": "\\", "'": "'", '"': '"' };
        result += map[esc] ?? esc;
      } else {
        result += ch;
        this.pos++;
      }
    }
    this.fail("unterminated string");
    return "";
  }

  private readNumber(): number {
    const start = this.pos;
    const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.src.slice(this.pos));
    if (!m) this.fail("invalid number");
    this.pos += m![0].length;
    return Number(this.src.slice(start, this.pos));
  }

  private assertSafeId(name: string): void {
    if (FORBIDDEN_IDS.has(name)) this.fail(`identifier '${name}' is not allowed`);
  }

  private assertSafeKey(key: string): void {
    if (FORBIDDEN_KEYS.has(key)) this.fail(`member key '${key}' is not allowed`);
  }

  private fail(msg: string): never {
    throw new Error(`Expression error at ${this.pos}: ${msg}`);
  }
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

function evaluate(node: Node, scope: Record<string, any>): any {
  switch (node.type) {
    case "Literal":
      return node.value;
    case "Identifier":
      return Object.prototype.hasOwnProperty.call(scope, node.name) ? scope[node.name] : undefined;
    case "Array":
      return node.elements.map((el) => evaluate(el, scope));
    case "Object": {
      const obj: Record<string, any> = {};
      for (const p of node.properties) obj[p.key] = evaluate(p.value, scope);
      return obj;
    }
    case "Unary": {
      const v = evaluate(node.arg, scope);
      return node.op === "!" ? !v : node.op === "-" ? -v : +v;
    }
    case "Binary":
      return evalBinary(node.op, evaluate(node.left, scope), evaluate(node.right, scope));
    case "Logical": {
      const left = evaluate(node.left, scope);
      if (node.op === "&&") return left && evaluate(node.right, scope);
      if (node.op === "||") return left || evaluate(node.right, scope);
      return left ?? evaluate(node.right, scope);
    }
    case "Conditional":
      return evaluate(node.test, scope) ? evaluate(node.yes, scope) : evaluate(node.no, scope);
    case "Member": {
      const obj = evaluate(node.object, scope);
      if (obj == null) return undefined;
      const key = node.computed ? String(evaluate(node.key as Node, scope)) : (node.key as string);
      if (FORBIDDEN_KEYS.has(key)) throw new Error(`Expression error: member key '${key}' is not allowed`);
      return obj[key];
    }
  }
}

function evalBinary(op: string, l: any, r: any): any {
  switch (op) {
    case "+": return l + r;
    case "-": return l - r;
    case "*": return l * r;
    case "/": return l / r;
    case "%": return l % r;
    case "<": return l < r;
    case "<=": return l <= r;
    case ">": return l > r;
    case ">=": return l >= r;
    case "===": return l === r;
    case "!==": return l !== r;
    case "==": return l == r;
    case "!=": return l != r;
    default: return undefined;
  }
}

function isDigit(ch: string | undefined): boolean {
  return !!ch && ch >= "0" && ch <= "9";
}
