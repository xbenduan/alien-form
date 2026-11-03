import { afterEach, expect, it } from "vitest";
import { For } from "solid-js";
import { render } from "solid-js/web";
import type { FieldProps, ValueScope } from "../runtime/types";
import { resolveModel } from "../model/field";
import { createValueScope } from "../runtime/scope";
import { createQueryState } from "../runtime/query";
import { createRender, createRenderItem } from "./render";

const model = resolveModel(
  {
    schemaVersion: 1,
    id: "orders",
    title: "订单",
    data: {
      total: { type: "number", default: 2, readOnly: true, ui: { form: { component: "Money" } } },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            price: {
              type: "number",
              ui: { form: { component: "Money" } },
              props: { title: "金额" },
            },
          },
        },
      },
    },
  },
  {},
  { fields: { "/total": { read: true, filter: ["eq", "between", "isNull"], sort: true } } },
);
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
});
const mount = (body: () => any) => {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(body, host);
  return host;
};

it("同一字段按场景选择组件，筛选的 operand 与记录只读和默认值独立", () => {
  let props!: FieldProps;
  const query = createQueryState(model);
  const host = mount(() => {
    const Item = createRenderItem({
      model,
      scope: () => {
        throw new Error("独立查询不使用 scope");
      },
      components: {
        NumberInput: (value) => {
          props = value;
          return (
            <output>
              {value.scene}:{String(value.value)}
            </output>
          );
        },
      },
    });
    return <Item field={model.field("/total")} scene="filter" binding={query.field("/total")} />;
  });
  expect(query.clauses()).toEqual([]);
  expect(props.readOnly).toBe(false);
  expect(props.value).toBeUndefined();
  props.onChange(0);
  expect(host.textContent).toBe("filter:0");
  expect(query.clauses()).toEqual([{ field: "/total", operator: "eq", operand: 0 }]);
  query.field("/total").setOperator("between");
  props.onChange([0, 5]);
  expect(props.multiple).toBe(true);
  expect(query.clauses()).toEqual([{ field: "/total", operator: "between", operand: [0, 5] }]);
  query.reset();
  expect(query.clauses()).toEqual([]);
});

it("数组字段跟随稳定项身份移动，嵌套字段复用组件和共享 props", () => {
  let scope!: ValueScope;
  const host = mount(() => {
    scope = createValueScope({ value: { lines: [{ price: 3 }, { price: 7 }] } }, model.valueSchema);
    const Render = createRender({
      model,
      scope: () => scope,
      components: {
        ObjectFields: (props) => props.children,
        ArrayFields: (props: FieldProps) => {
          const Item = props.Item!;
          return <For each={props.array!.items()}>{(item) => <Item scope={item.scope} />}</For>;
        },
        Money: (props) => <input title={props.title} value={props.value} />,
      },
    });
    return <Render field="/lines" />;
  });
  const inputs = () => [...host.querySelectorAll("input")];
  expect(inputs().map((input) => input.value)).toEqual(["3", "7"]);
  expect(inputs().map((input) => input.title)).toEqual(["金额", "金额"]);
  const first = inputs()[0]!;
  const array = scope.array("/lines");
  array.move(array.items()[0]!.key, 1);
  expect(inputs().map((input) => input.value)).toEqual(["7", "3"]);
  expect(inputs()[1]).toBe(first);
  scope.set("/lines/1/price", 9);
  expect(first.value).toBe("9");
});

it("空值筛选是显式条件，停用与 null 不混淆，非法范围无法提交", () => {
  const query = createQueryState(model);
  const field = query.field("/total");
  field.set(null);
  expect(query.clauses()).toEqual([{ field: "/total", operator: "isNull" }]);
  field.setActive(false);
  expect(query.clauses()).toEqual([]);
  field.setOperator("between");
  field.set([9, 1]);
  expect(() => query.clauses()).toThrow(/筛选条件无效/);
  expect(() => field.setOperator("contains")).toThrow(/不支持/);
});
