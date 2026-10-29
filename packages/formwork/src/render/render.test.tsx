import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import type { DataSchema } from "../model/types";
import { createValueScope } from "../runtime/scope";
import type { ActionContext, FieldProps, ValueScope } from "../runtime/types";
import { createRender } from "./render";

const schema: DataSchema = {
  type: "object",
  properties: {
    first: { type: "number" },
    second: { type: "number" },
    total: { type: "number" },
    flag: { type: "boolean" },
  },
};
const ctx: ActionContext = {
  models: {} as ActionContext["models"],
  params: {},
  fn: {},
  signal: new AbortController().signal,
  navigate: () => {},
  open: async () => ({ status: "cancelled" }),
  complete: () => {},
};
const Field: Component<FieldProps> = (props) => (
  <input
    value={String(props.value ?? "")}
    onInput={(event) => props.onChange(Number(event.currentTarget.value))}
  />
);
const mount = (body: Component) => {
  const element = document.createElement("div");
  document.body.append(element);
  const dispose = render(() => body({}), element);
  return {
    element,
    dispose: () => {
      dispose();
      element.remove();
    },
  };
};
describe("共用 Render 的绑定与表达式", () => {
  it("同一 Render 响应值更新、getter 与单字段覆盖", () => {
    let scope!: ValueScope;
    const app = mount(() => {
      scope = createValueScope({ value: { first: 1 } }, schema);
      const Render = createRender({ ctx, scope: () => scope, components: { NumberInput: Field } });
      return <Render field="/first" />;
    });
    expect(app.element.querySelector("input")?.value).toBe("1");
    scope.set("/first", 7);
    expect(app.element.querySelector("input")?.value).toBe("7");
    app.dispose();
  });
  it("事件不提前调用、Promise 乱序不覆盖最近属性、只依赖实际读取字段", async () => {
    let scope!: ValueScope;
    let calls = 0;
    let quoteCalls = 0;
    const pending: Array<(value: string) => void> = [];
    const app = mount(() => {
      scope = createValueScope({ value: { first: 1, second: 1 } }, schema);
      const Render = createRender({
        ctx: {
          ...ctx,
          fn: {
            quote: () => {
              quoteCalls++;
              return new Promise<string>((resolve) => pending.push(resolve));
            },
            click: () => calls++,
          },
        },
        scope: () => scope,
        components: {
          Button: (props) => (
            <button title={props.title} onClick={props.onClick}>
              执行
            </button>
          ),
        },
      });
      return (
        <Render
          view={{
            component: "Button",
            props: { title: "{{ fn.quote($values.first) }}", onClick: "{{ () => fn.click() }}" },
          }}
        />
      );
    });
    expect(calls).toBe(0);
    scope.set("/second", 2);
    expect(quoteCalls).toBe(1);
    scope.set("/first", 2);
    expect(quoteCalls).toBe(2);
    pending[1]!("最新");
    await Promise.resolve();
    pending[0]!("过期");
    await Promise.resolve();
    expect(app.element.querySelector("button")?.title).toBe("最新");
    app.element.querySelector("button")!.click();
    expect(calls).toBe(1);
    app.dispose();
  });
  it("value writer 正常计算，动态自引用报告环且不写入", () => {
    let scope!: ValueScope;
    const app = mount(() => {
      scope = createValueScope({ value: { first: 3, total: 0, flag: false } }, schema);
      const Render = createRender({ ctx, scope: () => scope, components: { NumberInput: Field } });
      return (
        <Render
          view={{
            component: "NumberInput",
            field: "/total",
            bindings: { value: "{{ $values.flag ? $values.total + 1 : $values.first * 2 }}" },
          }}
        />
      );
    });
    expect(scope.value()).toMatchObject({ total: 6 });
    scope.set("/first", 4);
    expect(scope.value()).toMatchObject({ total: 8 });
    scope.set("/flag", true);
    expect(app.element.textContent).toContain("EXPRESSION_CYCLE");
    expect(scope.value()).toMatchObject({ total: 8 });
    app.dispose();
  });
  it("跨字段 writer 环返回诊断，异步 writer 在字段重置后不写回", async () => {
    let scope!: ValueScope;
    let resolve!: (value: number) => void;
    const app = mount(() => {
      scope = createValueScope({ value: { first: 1, second: 2, total: 0 } }, schema);
      const Render = createRender({
        ctx: { ...ctx, fn: { quote: () => new Promise<number>((done) => (resolve = done)) } },
        scope: () => scope,
        components: { Object: (props) => props.children, NumberInput: Field },
      });
      return (
        <Render
          view={{
            component: "Object",
            field: "",
            children: [
              {
                component: "NumberInput",
                field: "/first",
                bindings: { value: "{{ $values.second + 1 }}" },
              },
              {
                component: "NumberInput",
                field: "/second",
                bindings: { value: "{{ $values.first + 1 }}" },
              },
              {
                component: "NumberInput",
                field: "/total",
                bindings: { value: "{{ fn.quote() }}" },
              },
            ],
          }}
        />
      );
    });
    expect(app.element.textContent).toContain("EXPRESSION_CYCLE");
    scope.reset({ first: 10, second: 20, total: 99 });
    resolve(7);
    await Promise.resolve();
    expect(scope.value()).toMatchObject({ total: 99 });
    app.dispose();
  });
  it("显式 visible 隐藏保留值，父级 readOnly 限制子字段写入", () => {
    let scope!: ValueScope;
    const app = mount(() => {
      scope = createValueScope({ value: { first: 1, flag: true } }, schema);
      const Render = createRender({
        ctx,
        scope: () => scope,
        components: { Object: (props) => props.children, NumberInput: Field },
      });
      return (
        <Render
          view={{
            component: "Object",
            field: "",
            bindings: { readOnly: true, visible: "{{ $values.flag }}" },
            children: [{ component: "NumberInput", field: "/first" }],
          }}
        />
      );
    });
    scope.set("/flag", false);
    expect(app.element.querySelector("input")).toBeNull();
    expect(scope.value()).toMatchObject({ first: 1 });
    scope.set("/flag", true);
    expect(app.element.querySelector("input")?.value).toBe("1");
    app.dispose();
  });
});
