import { afterEach, expect, it } from "vitest";
import { For } from "solid-js";
import { render } from "solid-js/web";
import type { ActionContext, FieldProps, ValueScope } from "../runtime/types";
import type { RuntimeSchema } from "../model/types";
import { createValueScope } from "../runtime/scope";
import { createRender } from "./render";

const model: RuntimeSchema = {
  id: "orders",
  title: "订单",
  data: {
    type: "object",
    properties: {
      quantity: { type: "number", default: 2 },
      total: { type: "number" },
      lines: {
        type: "array",
        items: { type: "object", properties: { price: { type: "number" } } },
      },
    },
  },
  fields: {
    "/total": {
      form: {
        component: "Money",
        props: { title: "表单金额" },
        bindings: { value: "{{ $values.quantity * 10 }}" },
      },
      table: { component: "Money", props: { title: "单元格金额" } },
    },
    "/lines/*/price": { form: { component: "Money", props: { title: "{{ $value + '元' }}" } } },
  },
};
const ctx: ActionContext = {
  router: "list",
  schema: model,
  params: {},
  api: {} as ActionContext["api"],
  signal: new AbortController().signal,
  fn: {},
  navigate: () => {},
  open: async () => ({ status: "cancelled" }),
  complete: () => {},
};
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

it("字段简写继承展示、显式 View 覆盖 props，表格不执行表单 writer", () => {
  let form!: ValueScope;
  let row!: ValueScope;
  const host = mount(() => {
    form = createValueScope({}, model.data);
    row = createValueScope(
      { readOnly: true, defaults: false, value: { quantity: 99, total: 42 } },
      model.data,
    );
    const Render = createRender({
      ctx,
      scope: () => form,
      components: { Money: (props) => <input aria-label={props.title} value={props.value} /> },
    });
    return (
      <>
        <Render view={{ field: "/total", props: { title: "显式金额" } }} />
        <Render scope={row} mode="table" field="/total" />
      </>
    );
  });
  expect(host.querySelector<HTMLInputElement>('[aria-label="显式金额"]')!.value).toBe("20");
  expect(host.querySelector<HTMLInputElement>('[aria-label="单元格金额"]')!.value).toBe("42");
  form.set("/quantity", 3);
  expect(form.value()).toMatchObject({ total: 30 });
  expect(row.value()).toMatchObject({ total: 42 });
  expect(host.textContent).not.toContain("READ_ONLY");
});

it("数组通配配置跟随稳定项身份移动，嵌套默认渲染省略组件名称", () => {
  let scope!: ValueScope;
  const host = mount(() => {
    scope = createValueScope({ value: { lines: [{ price: 3 }, { price: 7 }] } }, model.data);
    const Render = createRender({
      ctx,
      scope: () => scope,
      components: {
        Object: (props) => props.children,
        Array: (props: FieldProps) => {
          const Item = props.Item!;
          return <For each={props.array!.items()}>{(item) => <Item scope={item.scope} />}</For>;
        },
        Money: (props) => <input title={props.title} value={props.value} />,
      },
    });
    return <Render view={{ field: "/lines", children: [{ field: "/price" }] }} />;
  });
  const inputs = () => [...host.querySelectorAll("input")];
  expect(inputs().map((input) => input.title)).toEqual(["3元", "7元"]);
  const first = inputs()[0]!;
  const array = scope.array("/lines");
  array.move(array.items()[0]!.key, 1);
  expect(inputs().map((input) => input.title)).toEqual(["7元", "3元"]);
  expect(inputs()[1]).toBe(first);
  scope.set("/lines/1/price", 9);
  expect(first.title).toBe("9元");
});

it("独立查询 scope 的额外字段不继承不存在的模型展示", () => {
  const host = mount(() => {
    const query = createValueScope(
      {
        schema: {
          type: "object",
          properties: {
            transient: { type: "object", properties: { keyword: { type: "string" } } },
          },
        },
        value: { transient: { keyword: "查询" } },
      },
      model.data,
    );
    const Render = createRender({
      ctx,
      scope: () => query,
      components: {
        Object: (props) => props.children,
        Input: (props) => <input value={props.value} />,
      },
    });
    return <Render mode="filter" />;
  });
  expect(host.querySelector("input")!.value).toBe("查询");
});
