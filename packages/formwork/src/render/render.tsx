import { createMemo, For } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FormworkError } from "../model/errors";
import { readPointer, escapePointer, isObject } from "../model/pointer";
import { resolveField } from "../model/field";
import type { ResolvedModel } from "../model/field";
import type {
  ComponentRegistry,
  FieldContainerProps,
  FieldProps,
  RenderItemProps,
  RenderProps,
  ValueScope,
} from "../runtime/types";
import { schemaType } from "../model/validation";
import { controlledProps } from "../model/field";

type Configuration = {
  model: ResolvedModel;
  components: ComponentRegistry;
  fieldContainer?: Component<FieldContainerProps>;
  scope: () => ValueScope;
};
const DefaultField: Component<FieldContainerProps> = (props) => <>{props.children}</>;

/** 创建字段 renderer，只递归真实对象和数组数据，不解释页面布局。 */
export function createRenderItem(configuration: Configuration): Component<RenderItemProps> {
  const RenderItem: Component<RenderItemProps> = (props) => {
    const field = props.field;
    const resolved = createMemo(() =>
      resolveField(field, {
        scene: props.scene,
        component: props.component,
        props: props.props,
      }),
    );
    const Component = () => {
      const component = configuration.components[resolved().component];
      if (!component)
        throw new FormworkError("UNKNOWN_COMPONENT", `组件未注册 ${resolved().component}`);
      return component;
    };
    const binding = props.binding;
    if (binding?.kind === "filter" && props.scene !== "filter")
      throw new FormworkError("INVALID_BINDING", "FilterBinding 只用于 filter 场景");
    if (props.scene === "filter" && binding?.kind !== "filter")
      throw new FormworkError("INVALID_BINDING", "filter 必须使用 FilterBinding");
    const filter = binding?.kind === "filter" ? binding : undefined;
    const scope = binding?.kind === "value" ? binding.scope : undefined;
    const value = () => (binding ? binding.value() : props.value);
    const readonly = () =>
      !!props.readOnly ||
      !binding ||
      (filter ? false : !!field.schema.readOnly) ||
      !!binding?.readOnly();
    const editable = () =>
      Object.fromEntries(
        Object.entries(resolved().props).filter(([key]) => !controlledProps.has(key)),
      );
    const Child: Component<{
      pointer: string;
      scope?: ValueScope;
      value?: import("../model/types").JsonValue;
    }> = (child) => (
      <RenderItem
        field={configuration.model.field(child.pointer)}
        scene={props.scene}
        {...(child.scope ? { binding: child.scope.field("") } : { value: child.value })}
        record={props.record}
        readOnly={readonly()}
        disabled={props.disabled}
      />
    );
    const Item: FieldProps["Item"] = (item) => (
      <Child pointer={`${field.path}/*`} scope={item.scope} />
    );
    const ValueItem: FieldProps["ValueItem"] = (item) => (
      <Child pointer={`${field.path}/*`} value={item.value} />
    );
    const childKeys = () => [
      ...new Set([
        ...Object.keys(field.schema.properties ?? {}),
        ...(field.schema.additionalProperties && isObject(value())
          ? Object.keys(value() as object)
          : []),
      ]),
    ];
    const Children = () => (
      <For each={childKeys()}>
        {(key) => {
          const pointer = `/${escapePointer(key)}`;
          const child = configuration.model.field(`${field.path}${pointer}`);
          if (child.schema.ui?.[props.scene] === false) return null;
          return (
            <Dynamic
              component={configuration.fieldContainer ?? DefaultField}
              path={scope ? scope.field(pointer).path() : `${field.path}${pointer}`}
              title={child.schema.title ?? key}
              field={child}
              scene={props.scene}
              schema={child.valueSchema}
              required={!!child.schema.required}
              errors={scope?.field(pointer).errors() ?? []}
            >
              <Child
                pointer={`${field.path}${pointer}`}
                scope={scope?.field(pointer).scope}
                value={
                  readPointer(value(), pointer) as import("../model/types").JsonValue | undefined
                }
              />
            </Dynamic>
          );
        }}
      </For>
    );
    return (
      <Dynamic
        component={Component()}
        {...editable()}
        field={field}
        scene={props.scene}
        value={value()}
        onChange={(next: import("../model/types").JsonValue | undefined) => {
          if (readonly()) throw new FormworkError("READ_ONLY", "字段只读");
          if (props.disabled) throw new FormworkError("DISABLED", "字段已禁用");
          binding!.set(next);
        }}
        readOnly={readonly()}
        disabled={!!props.disabled}
        errors={binding?.errors() ?? []}
        schema={filter?.operandSchema() ?? field.valueSchema}
        options={field.options}
        relation={field.schema.relation}
        multiple={
          filter
            ? schemaType(filter.operandSchema() ?? { type: "null" }) === "array"
            : field.schema.type === "array"
        }
        operator={filter?.operator()}
        operandSchema={filter?.operandSchema()}
        record={props.record}
        {...(field.schema.items && scope ? { array: scope.array(""), Item } : {})}
        {...(field.schema.items ? { ValueItem } : {})}
        Detail={() => (
          <RenderItem field={field} scene="detail" value={value()} record={props.record} />
        )}
      >
        <Children />
      </Dynamic>
    );
  };
  return RenderItem;
}

/** 为简单表单提供字段遍历适配器；复杂页面直接组合 RenderItem。 */
export function createRender(configuration: Configuration): Component<RenderProps> {
  return (props) => {
    const RenderItem = createRenderItem({
      ...configuration,
      get components() {
        return { ...configuration.components, ...props.components };
      },
      get fieldContainer() {
        return props.fieldContainer ?? configuration.fieldContainer;
      },
    });
    const scope = props.scope ?? configuration.scope();
    const scene = props.scene ?? props.mode ?? "form";
    const fields = props.field
      ? [configuration.model.field(props.field)]
      : configuration.model.fields;
    const Content = () => (
      <For each={fields.filter((field) => field.schema.ui?.[scene] !== false)}>
        {(field) => (
          <Dynamic
            component={props.fieldContainer ?? configuration.fieldContainer ?? DefaultField}
            path={field.path}
            title={field.schema.title ?? field.path.slice(1)}
            schema={field.valueSchema}
            field={field}
            scene={scene}
            required={!!field.schema.required}
            errors={scope.field(field.path).errors()}
          >
            <RenderItem field={field} scene={scene} binding={scope.field(field.path)} />
          </Dynamic>
        )}
      </For>
    );
    return props.container ? (
      <Dynamic component={props.container}>
        <Content />
      </Dynamic>
    ) : (
      <Content />
    );
  };
}
