import { describe, expect, it, vi } from "vitest";
import { compileExpr, evaluateExpression } from "../expression";
import type { ExpressionScope } from "../types";

const emptyAccessor = () => undefined;
const emptyNamespace = {};

function form(values: Record<string, unknown> = {}): ExpressionScope["$form"] {
  return {
    getFieldValue: (path: string | readonly (string | number)[]) =>
      values[typeof path === "string" ? path : path.join(".")],
  } as ExpressionScope["$form"];
}

function scope(overrides: Partial<ExpressionScope> = {}): ExpressionScope {
  return {
    $self: {} as ExpressionScope["$self"],
    $form: form(),
    $value: undefined,
    $row: undefined,
    $path: "",
    $service: emptyAccessor,
    $utils: emptyNamespace,
    $enums: emptyNamespace,
    $query: {},
    ...overrides,
  };
}

describe("compileExpr", () => {
  it("unwraps schema expression markers", () => {
    expect(
      compileExpr('{{ $form.getFieldValue("price") * $form.getFieldValue("quantity") }}')(
        scope({ $form: form({ price: 3, quantity: 4 }) }),
      ),
    ).toBe(12);
  });

  it("supports function calls", () => {
    const list = vi.fn(() => ["a"]);
    expect(
      evaluateExpression(
        '{{ $service("records.list")() }}',
        scope({
          $service: () => list,
        }),
      ),
    ).toEqual(["a"]);
    expect(list).toHaveBeenCalledOnce();
  });

  it("exposes the page mode as a scoped identifier", () => {
    expect(compileExpr("{{ mode === 'detail' }}")(scope({ mode: "detail" }))).toBe(true);
  });

  it("returns arrow functions without invoking them", () => {
    const handler = compileExpr<(row: { id: number }) => number>(
      '{{ (row) => $service("records.remove")(row.id) }}',
    )(
      scope({
        $service: () => (id: number) => id,
      }),
    );
    expect(handler({ id: 7 })).toBe(7);
  });

  it("supports objects, arrays, optional chaining and templates", () => {
    expect(
      compileExpr(
        "{{ ({ label: `${$form.getFieldValue('name') ?? 'unknown'}!`, values: [1, 2] }) }}",
      )(scope({ $form: form({ name: "Alien" }) })),
    ).toEqual({ label: "Alien!", values: [1, 2] });
  });

  it("caches compiled functions by normalized source", () => {
    expect(compileExpr('{{ $form.getFieldValue("id") }}')).toBe(
      compileExpr('$form.getFieldValue("id")'),
    );
  });

  it("does not expose arbitrary values as flat identifiers", () => {
    expect(() => compileExpr("name")(scope({ $form: form({ name: "hidden" }) }))).toThrow(
      ReferenceError,
    );
  });

  it("reads only scope properties referenced by the expression", () => {
    const current = scope({ $form: form({ name: "Alien" }) });
    const valueRead = vi.fn();
    const rowRead = vi.fn();
    Object.defineProperties(current, {
      $value: { get: valueRead },
      $row: { get: rowRead },
    });

    expect(compileExpr('{{ $form.getFieldValue("name") }}')(current)).toBe("Alien");
    expect(valueRead).not.toHaveBeenCalled();
    expect(rowRead).not.toHaveBeenCalled();
  });
});
