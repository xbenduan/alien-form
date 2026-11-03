import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { resolveModel } from "../model/field";
import { createValueScope } from "../runtime/scope";
import type { FieldProps, ValueScope } from "../runtime/types";
import { createRender, createRenderItem } from "./render";

const model = resolveModel({
  schemaVersion: 1,
  id: "orders",
  title: "订单",
  data: { first: { type: "number", minimum: 1, props: { placeholder: "金额" } } },
});
const Field: Component<FieldProps> = (props) => (
  <input
    value={String(props.value ?? "")}
    onInput={(event) => props.onChange(Number(event.currentTarget.value))}
    aria-invalid={!!props.errors.length}
  />
);
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  document.body.replaceChildren();
});
const mount = (body: Component) => {
  const element = document.createElement("div");
  document.body.append(element);
  stop = render(() => body({}), element);
  return element;
};

describe("字段 renderer 与页面代码边界", () => {
  it("Render 跟随 scope，局部组件覆盖不影响默认注册", () => {
    let scope!: ValueScope;
    const element = mount(() => {
      scope = createValueScope({ value: { first: 1 } }, model.valueSchema);
      const Render = createRender({
        model,
        scope: () => scope,
        components: { NumberInput: Field },
      });
      return (
        <>
          <Render field="/first" />
          <Render
            field="/first"
            components={{
              NumberInput: (props) => <output>{props.value}</output>,
            }}
          />
        </>
      );
    });
    scope.set("/first", 7);
    expect(element.querySelector("input")?.value).toBe("7");
    expect(element.querySelector("output")?.textContent).toBe("7");
  });
  it("表格直接渲染值，绝不创建或读取记录 scope", () => {
    let setValue!: (value: number) => void;
    let seen!: FieldProps;
    const element = mount(() => {
      const [value, update] = createSignal(0);
      setValue = update;
      const Item = createRenderItem({
        model,
        scope: () => {
          throw new Error("table 不应访问 scope");
        },
        components: {
          NumberInput: (props) => {
            seen = props;
            return <output>{String(props.value)}</output>;
          },
        },
      });
      return <Item field={model.field("/first")} scene="table" value={value()} />;
    });
    expect(element.textContent).toBe("0");
    expect(seen.scene).toBe("table");
    expect(seen.readOnly).toBe(true);
    expect(() => seen.onChange(3)).toThrow(/只读/);
    setValue(8);
    expect(element.textContent).toBe("8");
  });
  it("组件覆盖响应更新，代码事件只在点击时执行，受控 props 无法伪造", () => {
    let change!: (component: string) => void;
    let calls = 0;
    let seen!: FieldProps;
    const element = mount(() => {
      const [component, setComponent] = createSignal("First");
      change = setComponent;
      const scope = createValueScope({ value: { first: 2 } }, model.valueSchema);
      const Item = createRenderItem({
        model,
        scope: () => scope,
        components: {
          First: (props) => {
            seen = props;
            return <button onClick={props.onClick}>事件</button>;
          },
          Second: (props) => <output>{props.value}</output>,
        },
      });
      return (
        <Item
          field={model.field("/first")}
          scene="form"
          binding={scope.field("/first")}
          component={component()}
          props={{ value: 99, scene: "table", onClick: () => calls++ }}
        />
      );
    });
    expect(calls).toBe(0);
    expect(seen.value).toBe(2);
    expect(seen.scene).toBe("form");
    element.querySelector("button")!.click();
    expect(calls).toBe(1);
    change("Second");
    expect(element.querySelector("output")?.textContent).toBe("2");
  });
  it("校验错误随字段传递，隐藏和重新挂载保留值", async () => {
    let scope!: ValueScope;
    let show!: (value: boolean) => void;
    const element = mount(() => {
      const [visible, setVisible] = createSignal(true);
      show = setVisible;
      scope = createValueScope({ value: { first: 0 } }, model.valueSchema);
      const Render = createRender({
        model,
        scope: () => scope,
        components: { NumberInput: Field },
      });
      return (
        <Show when={visible()}>
          <Render />
        </Show>
      );
    });
    expect((await scope.validate()).status).toBe("invalid");
    expect(element.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    show(false);
    expect(element.querySelector("input")).toBeNull();
    expect(scope.value()).toEqual({ first: 0 });
    show(true);
    scope.set("/first", 4);
    expect(element.querySelector("input")?.value).toBe("4");
  });
  it("readOnly 和 disabled 都由 renderer 写入口执行", () => {
    let readonly!: FieldProps;
    let disabled!: FieldProps;
    let scope!: ValueScope;
    mount(() => {
      scope = createValueScope({ value: { first: 1 } }, model.valueSchema);
      const Item = createRenderItem({
        model,
        scope: () => scope,
        components: {
          Read: (props) => {
            readonly = props;
            return null;
          },
          Disabled: (props) => {
            disabled = props;
            return null;
          },
        },
      });
      return (
        <>
          <Item
            field={model.field("/first")}
            binding={scope.field("/first")}
            scene="form"
            component="Read"
            readOnly
          />
          <Item
            field={model.field("/first")}
            binding={scope.field("/first")}
            scene="form"
            component="Disabled"
            disabled
          />
        </>
      );
    });
    expect(() => readonly.onChange(2)).toThrow(/只读/);
    expect(() => disabled.onChange(2)).toThrow(/禁用/);
    expect(scope.value()).toEqual({ first: 1 });
  });
});
