import { describe, expect, it, vi } from "vitest";
import { compileExpr, evaluateExpression } from "../expression";
import type { ExpressionScope } from "../types";

function scope(overrides: Partial<ExpressionScope> = {}): ExpressionScope {
  return {
    $values: {},
    $self: {} as ExpressionScope["$self"],
    $form: {} as ExpressionScope["$form"],
    $value: undefined,
    $row: undefined,
    $path: "",
    $service: {},
    $utils: {},
    $enums: {},
    $query: {},
    ...overrides,
  };
}

describe("compileExpr", () => {
  it("unwraps schema expression markers", () => {
    expect(
      compileExpr("{{ $values.price * $values.quantity }}")(
        scope({ $values: { price: 3, quantity: 4 } }),
      ),
    ).toBe(12);
  });

  it("supports function calls", () => {
    const list = vi.fn(() => ["a"]);
    expect(
      evaluateExpression(
        "{{ $service.records.list() }}",
        scope({
          $service: { records: { list } },
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
      "{{ (row) => $service.records.remove(row.id) }}",
    )(
      scope({
        $service: { records: { remove: (id: number) => id } },
      }),
    );
    expect(handler({ id: 7 })).toBe(7);
  });

  it("supports objects, arrays, optional chaining and templates", () => {
    expect(
      compileExpr("{{ ({ label: `${$values.name ?? 'unknown'}!`, values: [1, 2] }) }}")(
        scope({ $values: { name: "Alien" } }),
      ),
    ).toEqual({ label: "Alien!", values: [1, 2] });
  });

  it("caches compiled functions by normalized source", () => {
    expect(compileExpr("{{ $values.id }}")).toBe(compileExpr("$values.id"));
  });

  it("does not expose arbitrary values as flat identifiers", () => {
    expect(() => compileExpr("name")(scope({ $values: { name: "hidden" } }))).toThrow(
      ReferenceError,
    );
  });
});
