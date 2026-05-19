/**
 * @alien-form/core — Restricted expression runtime
 *
 * `expression` rules intentionally support expressions only. They are parsed and
 * evaluated by this small interpreter instead of being compiled with
 * `new Function`. Function calls, statements, assignments, constructors and
 * reflective/global access are not part of the grammar. Use `computed` handlers
 * for business logic, functions, async work and side effects.
 */

type TokenType =
  | 'eof'
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'punctuator'

type Token = {
  type: TokenType
  value: string
  index: number
}

type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | ArrayNode
  | ObjectNode
  | UnaryNode
  | BinaryNode
  | LogicalNode
  | ConditionalNode
  | MemberNode

type LiteralNode = {
  type: 'Literal'
  value: any
}

type IdentifierNode = {
  type: 'Identifier'
  name: string
}

type ArrayNode = {
  type: 'ArrayExpression'
  elements: ExpressionNode[]
}

type ObjectNode = {
  type: 'ObjectExpression'
  properties: Array<{ key: string; value: ExpressionNode }>
}

type UnaryNode = {
  type: 'UnaryExpression'
  operator: '!' | '-' | '+'
  argument: ExpressionNode
}

type BinaryNode = {
  type: 'BinaryExpression'
  operator: string
  left: ExpressionNode
  right: ExpressionNode
}

type LogicalNode = {
  type: 'LogicalExpression'
  operator: '&&' | '||' | '??'
  left: ExpressionNode
  right: ExpressionNode
}

type ConditionalNode = {
  type: 'ConditionalExpression'
  test: ExpressionNode
  consequent: ExpressionNode
  alternate: ExpressionNode
}

type MemberNode = {
  type: 'MemberExpression'
  object: ExpressionNode
  property: ExpressionNode | string
  computed: boolean
}

const FORBIDDEN_IDENTIFIERS = new Set([
  'globalThis',
  'window',
  'document',
  'process',
  'Function',
  'eval',
  'constructor',
  'prototype',
  '__proto__',
  'new',
  'function',
  'class',
  'import',
  'this',
])

const FORBIDDEN_MEMBER_KEYS = new Set(['constructor', 'prototype', '__proto__'])

const TWO_CHAR_OPERATORS = new Set([
  '&&',
  '||',
  '??',
  '==',
  '!=',
  '<=',
  '>=',
])

const THREE_CHAR_OPERATORS = new Set(['===', '!=='])

const SINGLE_CHAR_OPERATORS = new Set(['!', '+', '-', '*', '/', '%', '<', '>'])
const PUNCTUATORS = new Set(['?', ':', '.', ',', '(', ')', '[', ']', '{', '}'])

export function evaluateExpression(expr: string, scope: Record<string, any>): any {
  const parser = new Parser(tokenize(expr))
  const ast = parser.parseExpression()
  parser.expectEnd()
  return evaluate(ast, scope)
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]

    if (/\s/u.test(char)) {
      index += 1
      continue
    }

    if (char === '`' || char === ';') {
      throw expressionError('statements and template literals are not allowed', index)
    }

    if (char === '=' && input[index + 1] !== '=' && input[index - 1] !== '=' && input[index + 1] !== '>') {
      throw expressionError('assignment is not allowed', index)
    }

    const three = input.slice(index, index + 3)
    if (THREE_CHAR_OPERATORS.has(three)) {
      tokens.push({ type: 'operator', value: three, index })
      index += 3
      continue
    }

    const two = input.slice(index, index + 2)
    if (two === '=>') {
      throw expressionError('function calls and function syntax are not allowed', index)
    }
    if (TWO_CHAR_OPERATORS.has(two)) {
      tokens.push({ type: 'operator', value: two, index })
      index += 2
      continue
    }

    if (SINGLE_CHAR_OPERATORS.has(char)) {
      tokens.push({ type: 'operator', value: char, index })
      index += 1
      continue
    }

    if (PUNCTUATORS.has(char)) {
      tokens.push({ type: 'punctuator', value: char, index })
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      const { value, nextIndex } = readString(input, index, char)
      tokens.push({ type: 'string', value, index })
      index = nextIndex
      continue
    }

    if (isDigit(char) || (char === '.' && isDigit(input[index + 1]))) {
      const { value, nextIndex } = readNumber(input, index)
      tokens.push({ type: 'number', value, index })
      index = nextIndex
      continue
    }

    if (isIdentifierStart(char)) {
      const start = index
      index += 1
      while (index < input.length && isIdentifierPart(input[index])) index += 1
      tokens.push({ type: 'identifier', value: input.slice(start, index), index: start })
      continue
    }

    throw expressionError(`unexpected token "${char}"`, index)
  }

  tokens.push({ type: 'eof', value: '', index })
  return tokens
}

function readString(input: string, index: number, quote: string): { value: string; nextIndex: number } {
  let result = ''
  let cursor = index + 1

  while (cursor < input.length) {
    const char = input[cursor]
    if (char === quote) {
      return { value: result, nextIndex: cursor + 1 }
    }

    if (char === '\\') {
      const escaped = input[cursor + 1]
      if (escaped === undefined) break
      const escapeMap: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        v: '\v',
        '0': '\0',
        '\\': '\\',
        '"': '"',
        "'": "'",
      }
      result += escapeMap[escaped] ?? escaped
      cursor += 2
      continue
    }

    result += char
    cursor += 1
  }

  throw expressionError('unterminated string literal', index)
}

function readNumber(input: string, index: number): { value: string; nextIndex: number } {
  const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/u.exec(input.slice(index))
  if (!match) throw expressionError('invalid number literal', index)
  return { value: match[0], nextIndex: index + match[0].length }
}

class Parser {
  private cursor = 0

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): ExpressionNode {
    return this.parseConditional()
  }

  expectEnd(): void {
    const token = this.peek()
    if (token.type !== 'eof') {
      if (token.value === '(') {
        throw expressionError('function calls are not allowed in expression rules; use computed instead', token.index)
      }
      throw expressionError(`unexpected token "${token.value}"`, token.index)
    }
  }

  private parseConditional(): ExpressionNode {
    const test = this.parseLogicalOr()
    if (!this.matchPunctuator('?')) return test

    const consequent = this.parseExpression()
    this.expectPunctuator(':')
    const alternate = this.parseExpression()
    return { type: 'ConditionalExpression', test, consequent, alternate }
  }

  private parseLogicalOr(): ExpressionNode {
    let node = this.parseLogicalAnd()
    while (this.matchOperator('||') || this.matchOperator('??')) {
      const operator = this.previous().value as '||' | '??'
      const right = this.parseLogicalAnd()
      node = { type: 'LogicalExpression', operator, left: node, right }
    }
    return node
  }

  private parseLogicalAnd(): ExpressionNode {
    let node = this.parseEquality()
    while (this.matchOperator('&&')) {
      const right = this.parseEquality()
      node = { type: 'LogicalExpression', operator: '&&', left: node, right }
    }
    return node
  }

  private parseEquality(): ExpressionNode {
    let node = this.parseComparison()
    while (
      this.matchOperator('===') ||
      this.matchOperator('!==') ||
      this.matchOperator('==') ||
      this.matchOperator('!=')
    ) {
      const operator = this.previous().value
      const right = this.parseComparison()
      node = { type: 'BinaryExpression', operator, left: node, right }
    }
    return node
  }

  private parseComparison(): ExpressionNode {
    let node = this.parseAdditive()
    while (
      this.matchOperator('<') ||
      this.matchOperator('<=') ||
      this.matchOperator('>') ||
      this.matchOperator('>=')
    ) {
      const operator = this.previous().value
      const right = this.parseAdditive()
      node = { type: 'BinaryExpression', operator, left: node, right }
    }
    return node
  }

  private parseAdditive(): ExpressionNode {
    let node = this.parseMultiplicative()
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value
      const right = this.parseMultiplicative()
      node = { type: 'BinaryExpression', operator, left: node, right }
    }
    return node
  }

  private parseMultiplicative(): ExpressionNode {
    let node = this.parseUnary()
    while (this.matchOperator('*') || this.matchOperator('/') || this.matchOperator('%')) {
      const operator = this.previous().value
      const right = this.parseUnary()
      node = { type: 'BinaryExpression', operator, left: node, right }
    }
    return node
  }

  private parseUnary(): ExpressionNode {
    if (this.matchOperator('!') || this.matchOperator('-') || this.matchOperator('+')) {
      const operator = this.previous().value as '!' | '-' | '+'
      return { type: 'UnaryExpression', operator, argument: this.parseUnary() }
    }
    return this.parseMember()
  }

  private parseMember(): ExpressionNode {
    let node = this.parsePrimary()

    while (true) {
      if (this.matchPunctuator('.')) {
        const property = this.expectIdentifier('expected property name after dot').value
        assertSafeMemberKey(property, this.previous().index)
        node = { type: 'MemberExpression', object: node, property, computed: false }
        continue
      }

      if (this.matchPunctuator('[')) {
        const property = this.parseExpression()
        this.expectPunctuator(']')
        node = { type: 'MemberExpression', object: node, property, computed: true }
        continue
      }

      if (this.peek().value === '(') {
        throw expressionError('function calls are not allowed in expression rules; use computed instead', this.peek().index)
      }

      return node
    }
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek()

    if (this.matchPunctuator('(')) {
      const node = this.parseExpression()
      this.expectPunctuator(')')
      return node
    }

    if (this.matchPunctuator('[')) {
      const elements: ExpressionNode[] = []
      if (!this.checkPunctuator(']')) {
        do {
          elements.push(this.parseExpression())
        } while (this.matchPunctuator(','))
      }
      this.expectPunctuator(']')
      return { type: 'ArrayExpression', elements }
    }

    if (this.matchPunctuator('{')) {
      const properties: Array<{ key: string; value: ExpressionNode }> = []
      if (!this.checkPunctuator('}')) {
        do {
          if (this.checkPunctuator('}')) break
          const key = this.parseObjectKey()
          this.expectPunctuator(':')
          properties.push({ key, value: this.parseExpression() })
        } while (this.matchPunctuator(','))
      }
      this.expectPunctuator('}')
      return { type: 'ObjectExpression', properties }
    }

    if (this.matchType('number')) return { type: 'Literal', value: Number(token.value) }
    if (this.matchType('string')) return { type: 'Literal', value: token.value }

    if (this.matchType('identifier')) {
      const name = token.value
      if (name === 'true') return { type: 'Literal', value: true }
      if (name === 'false') return { type: 'Literal', value: false }
      if (name === 'null') return { type: 'Literal', value: null }
      if (name === 'undefined') return { type: 'Literal', value: undefined }
      assertSafeIdentifier(name, token.index)
      return { type: 'Identifier', name }
    }

    throw expressionError(`unexpected token "${token.value}"`, token.index)
  }

  private parseObjectKey(): string {
    const token = this.peek()
    if (this.matchType('identifier') || this.matchType('string') || this.matchType('number')) {
      assertSafeMemberKey(token.value, token.index)
      return token.value
    }
    throw expressionError('expected object property key', token.index)
  }

  private matchOperator(value: string): boolean {
    return this.match('operator', value)
  }

  private matchPunctuator(value: string): boolean {
    return this.match('punctuator', value)
  }

  private matchType(type: TokenType): boolean {
    if (this.peek().type !== type) return false
    this.cursor += 1
    return true
  }

  private match(type: TokenType, value: string): boolean {
    const token = this.peek()
    if (token.type !== type || token.value !== value) return false
    this.cursor += 1
    return true
  }

  private checkPunctuator(value: string): boolean {
    const token = this.peek()
    return token.type === 'punctuator' && token.value === value
  }

  private expectPunctuator(value: string): void {
    const token = this.peek()
    if (!this.matchPunctuator(value)) {
      throw expressionError(`expected "${value}"`, token.index)
    }
  }

  private expectIdentifier(message: string): Token {
    const token = this.peek()
    if (!this.matchType('identifier')) throw expressionError(message, token.index)
    return token
  }

  private peek(): Token {
    return this.tokens[this.cursor]
  }

  private previous(): Token {
    return this.tokens[this.cursor - 1]
  }
}

function evaluate(node: ExpressionNode, scope: Record<string, any>): any {
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'Identifier':
      return Object.prototype.hasOwnProperty.call(scope, node.name) ? scope[node.name] : undefined
    case 'ArrayExpression':
      return node.elements.map((element) => evaluate(element, scope))
    case 'ObjectExpression': {
      const output: Record<string, any> = {}
      for (const property of node.properties) {
        output[property.key] = evaluate(property.value, scope)
      }
      return output
    }
    case 'UnaryExpression': {
      const value = evaluate(node.argument, scope)
      switch (node.operator) {
        case '!':
          return !value
        case '-':
          return -value
        case '+':
          return +value
      }
      return undefined
    }
    case 'BinaryExpression':
      return evaluateBinary(node.operator, evaluate(node.left, scope), evaluate(node.right, scope))
    case 'LogicalExpression': {
      const left = evaluate(node.left, scope)
      if (node.operator === '&&') return left && evaluate(node.right, scope)
      if (node.operator === '||') return left || evaluate(node.right, scope)
      return left ?? evaluate(node.right, scope)
    }
    case 'ConditionalExpression':
      return evaluate(node.test, scope) ? evaluate(node.consequent, scope) : evaluate(node.alternate, scope)
    case 'MemberExpression': {
      const object = evaluate(node.object, scope)
      if (object == null) return undefined
      const key = node.computed ? evaluate(node.property as ExpressionNode, scope) : node.property
      assertSafeMemberKey(String(key), 0)
      return object[key as keyof typeof object]
    }
  }
}

function evaluateBinary(operator: string, left: any, right: any): any {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return left / right
    case '%':
      return left % right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '==':
      return left == right
    case '!=':
      return left != right
    default:
      return undefined
  }
}

function assertSafeIdentifier(name: string, index: number): void {
  if (FORBIDDEN_IDENTIFIERS.has(name)) {
    throw expressionError(`identifier "${name}" is not allowed`, index)
  }
}

function assertSafeMemberKey(key: string, index: number): void {
  if (FORBIDDEN_MEMBER_KEYS.has(key)) {
    throw expressionError(`member key "${key}" is not allowed`, index)
  }
}

function expressionError(message: string, index: number): Error {
  return new Error(`Unsafe expression rejected: ${message} at ${index}`)
}

function isDigit(char: string | undefined): boolean {
  return !!char && char >= '0' && char <= '9'
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/u.test(char)
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/u.test(char)
}
