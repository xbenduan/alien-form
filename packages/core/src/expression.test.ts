import { describe, expect, it } from 'vitest';
import { evaluateExpression as ev } from './expression';

const run = (src: string, scope: Record<string, any> = {}) => ev(src, scope);

describe('expression — literals', () => {
  it('parses numbers (int, float, leading-dot, exponent)', () => {
    expect(run('42')).toBe(42);
    expect(run('3.14')).toBe(3.14);
    expect(run('.5')).toBe(0.5);
    expect(run('1e3')).toBe(1000);
    expect(run('2.5e-2')).toBe(0.025);
  });

  it('parses string literals with escapes', () => {
    expect(run("'hi'")).toBe('hi');
    expect(run('"hi"')).toBe('hi');
    expect(run("'a\\nb'")).toBe('a\nb');
    expect(run("'a\\tb'")).toBe('a\tb');
    expect(run("'quote\\''")).toBe("quote'");
    expect(run("'unknown\\xescape'")).toBe('unknownxescape');
  });

  it('parses boolean / null / undefined keywords', () => {
    expect(run('true')).toBe(true);
    expect(run('false')).toBe(false);
    expect(run('null')).toBe(null);
    expect(run('undefined')).toBe(undefined);
  });

  it('parses array and object literals', () => {
    expect(run('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(run('[]')).toEqual([]);
    expect(run('{ a: 1, b: 2 }')).toEqual({ a: 1, b: 2 });
    expect(run('{}')).toEqual({});
    expect(run("{ 'quoted key': 9 }")).toEqual({ 'quoted key': 9 });
  });
});

describe('expression — identifiers and member access', () => {
  it('reads identifiers from scope (own props only)', () => {
    expect(run('x', { x: 7 })).toBe(7);
    expect(run('missing', {})).toBe(undefined);
    // inherited props are not visible (hasOwnProperty guard)
    expect(run('toString', {})).toBe(undefined);
  });

  it('reads static member access', () => {
    expect(run('a.b.c', { a: { b: { c: 5 } } })).toBe(5);
  });

  it('reads computed member access', () => {
    expect(run('a["b"]', { a: { b: 6 } })).toBe(6);
    expect(run('a[k]', { a: { x: 1, y: 2 }, k: 'y' })).toBe(2);
  });

  it('short-circuits member access on null/undefined object', () => {
    expect(run('a.b', { a: null })).toBe(undefined);
    expect(run('a.b.c', { a: undefined })).toBe(undefined);
  });
});

describe('expression — operators', () => {
  it('arithmetic', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('10 % 3')).toBe(1);
    expect(run('7 / 2')).toBe(3.5);
    expect(run('5 - 8')).toBe(-3);
  });

  it('unary', () => {
    expect(run('-5')).toBe(-5);
    expect(run('+"3"')).toBe(3);
    expect(run('!true')).toBe(false);
    expect(run('!!0')).toBe(false);
  });

  it('comparison', () => {
    expect(run('1 < 2')).toBe(true);
    expect(run('2 <= 2')).toBe(true);
    expect(run('3 > 5')).toBe(false);
    expect(run('5 >= 5')).toBe(true);
  });

  it('equality (strict and loose)', () => {
    expect(run('1 === 1')).toBe(true);
    expect(run('1 !== 2')).toBe(true);
    expect(run('1 == "1"')).toBe(true);
    expect(run('1 != "2"')).toBe(true);
  });

  it('logical and / or / nullish with short-circuit', () => {
    expect(run('true && 2')).toBe(2);
    expect(run('false && x', { x: 9 })).toBe(false);
    expect(run('0 || "fallback"')).toBe('fallback');
    expect(run('"keep" || x', { x: 9 })).toBe('keep');
    expect(run('null ?? "d"')).toBe('d');
    expect(run('0 ?? "d"')).toBe(0);
  });

  it('ternary conditional', () => {
    expect(run('a > 5 ? "big" : "small"', { a: 10 })).toBe('big');
    expect(run('a > 5 ? "big" : "small"', { a: 1 })).toBe('small');
  });
});

describe('expression — security: forbidden identifiers', () => {
  for (const id of ['globalThis', 'window', 'process', 'eval', 'Function', 'constructor', 'this', '__proto__']) {
    it(`rejects the identifier "${id}"`, () => {
      expect(() => run(id)).toThrow(/not allowed/);
    });
  }
});

describe('expression — security: forbidden member keys', () => {
  it('rejects static .constructor access', () => {
    expect(() => run('a.constructor', { a: {} })).toThrow(/not allowed/);
  });
  it('rejects static .__proto__ access', () => {
    expect(() => run('a.__proto__', { a: {} })).toThrow(/not allowed/);
  });
  it('rejects static .prototype access', () => {
    expect(() => run('a.prototype', { a: {} })).toThrow(/not allowed/);
  });
  it('rejects computed access resolving to a forbidden key at eval time', () => {
    expect(() => run('a[k]', { a: {}, k: 'constructor' })).toThrow(/not allowed/);
  });
  it('rejects a forbidden object-literal key', () => {
    expect(() => run('{ constructor: 1 }')).toThrow(/not allowed/);
  });
});

describe('expression — security: no calls / assignment / statements', () => {
  it('rejects function calls', () => {
    expect(() => run('foo()')).toThrow(/function calls are not allowed/);
    expect(() => run('a.b()', { a: { b: () => 1 } })).toThrow(/function calls are not allowed/);
  });
  it('rejects assignment', () => {
    expect(() => run('x = 1')).toThrow(/assignment is not allowed/);
    // compound assignment: '+' is consumed as a binary op, leaving '=' to fail at expectEnd —
    // still rejected (security guarantee), just via a different message.
    expect(() => run('x += 1', { x: 1 })).toThrow(/unexpected character|assignment is not allowed/);
  });
  it('rejects a leading statement separator / template literal', () => {
    // a bare template literal hits the dedicated guard in primary()
    expect(() => run('`tpl`')).toThrow(/statements and template literals are not allowed/);
  });
  it('rejects a trailing statement separator', () => {
    // after a complete expression, ';' is caught by expectEnd as an unexpected char
    expect(() => run('1; 2')).toThrow(/unexpected character/);
  });
  it('rejects an arrow-function token (=>) by failing cleanly', () => {
    // `=>` is not a supported construct; it must throw rather than be silently parsed
    expect(() => run('a => a')).toThrow();
  });
});

describe('expression — parser error reporting', () => {
  it('throws on an unterminated string', () => {
    expect(() => run("'oops")).toThrow(/unterminated string/);
  });
  it('throws on a missing closing bracket', () => {
    expect(() => run('[1, 2')).toThrow();
  });
  it('throws on a trailing unexpected character', () => {
    expect(() => run('1 @ 2')).toThrow(/unexpected character/);
  });
  it('throws on a dangling member dot', () => {
    expect(() => run('a.', { a: {} })).toThrow(/expected property name/);
  });
});
