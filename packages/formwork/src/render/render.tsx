import { createMemo, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FormworkError } from "../model/errors";
import { expressionProperty } from "../runtime/expression";
import { scopeCell } from "../runtime/scope";
import type {
  ActionContext,
  ComponentRegistry,
  FieldContainerProps,
  FieldProps,
  RenderProps,
  ValueScope,
} from "../runtime/types";
import type { RuntimeView } from "../model/types";
import { defaultView, objectChildren } from "./default-view";

type Configuration = {
  ctx: ActionContext;
  components: ComponentRegistry;
  fieldContainer?: Component<FieldContainerProps>;
  scope: () => ValueScope;
  view?: RuntimeView;
};
const DefaultField: Component<FieldContainerProps> = (props) => (
  <>
    {props.children}
    <For each={props.errors}>
      {(error) => (
        <p role="alert">
          {error.code}: {error.message}
        </p>
      )}
    </For>
  </>
);

/** 以同一解释流程渲染默认表单、筛选与单字段表格。 */
export function createRender(configuration: Configuration): Component<RenderProps> {
  return (props) => {
    if (props.field !== undefined && props.view !== undefined)
      throw new FormworkError("INVALID_VIEW", "field 与 view 不能同时提供");
    const scope = props.scope ?? configuration.scope();
    const root = scopeCell(scope);
    const components = { ...configuration.components, ...props.components };
    const fieldContainer = props.fieldContainer ?? configuration.fieldContainer ?? DefaultField;
    const view =
      props.field !== undefined
        ? defaultView(root.at(props.field).schema, root.referenceRoot, props.field)
        : (props.view ??
          (props.scope ? undefined : configuration.view) ??
          defaultView(root.schema, root.referenceRoot));
    const Node: Component<{
      view: RuntimeView;
      scope: ValueScope;
      base: string;
      rootContainer?: boolean;
      readOnly?: boolean;
      disabled?: boolean;
    }> = (nodeProps) => {
      const node = nodeProps.view;
      const local = scopeCell(nodeProps.scope);
      const path = node.field === undefined ? undefined : `${nodeProps.base}${node.field}`;
      const cell = path === undefined ? undefined : local.at(path);
      const Component = components[node.component];
      if (!Component)
        throw new FormworkError("UNKNOWN_COMPONENT", `组件不存在 ${node.component}`, [
          { path: path ?? "", code: "UNKNOWN_COMPONENT", message: `未注册 ${node.component}` },
        ]);
      const evaluated = Object.fromEntries(
        Object.entries(node.props ?? {}).map(([name, value]) => [
          name,
          expressionProperty(value, configuration.ctx, nodeProps.scope, cell),
        ]),
      );
      const restrictions = Object.fromEntries(
        Object.entries(node.bindings ?? {}).map(([name, value]) => [
          name,
          expressionProperty(value, configuration.ctx, nodeProps.scope, cell, name === "value"),
        ]),
      );
      const expressionErrors = () =>
        [...Object.values(evaluated), ...Object.values(restrictions)].flatMap((result) =>
          result.errors(),
        );
      const errors = createMemo(() => [
        ...nodeProps.scope
          .errors()
          .filter(
            (issue) =>
              path === undefined || issue.path === path || issue.path.startsWith(path + "/"),
          ),
        ...expressionErrors(),
      ]);
      const readonly = () =>
        !!nodeProps.readOnly || !!cell?.readOnly || !!restrictions.readOnly?.value();
      const disabled = () => !!nodeProps.disabled || !!restrictions.disabled?.value();
      const childViews =
        cell && "properties" in cell.schema
          ? (node.children ?? objectChildren(cell.schema, cell.referenceRoot))
          : (node.children ?? []);
      const childBase = cell && "properties" in cell.schema ? path! : nodeProps.base;
      const Item: Component<{ scope: ValueScope }> = (itemProps) => {
        const itemCell = scopeCell(itemProps.scope);
        const itemViews =
          node.children ??
          ("properties" in itemCell.schema
            ? objectChildren(itemCell.schema, itemCell.referenceRoot)
            : [defaultView(itemCell.schema, itemCell.referenceRoot)]);
        return (
          <For each={itemViews}>
            {(child) => (
              <Node
                view={child}
                scope={itemProps.scope}
                base=""
                readOnly={readonly()}
                disabled={disabled()}
              />
            )}
          </For>
        );
      };
      const controlled: Partial<FieldProps> = cell
        ? {
            get value() {
              return cell.scope.value();
            },
            onChange: (next) => {
              if (readonly()) throw new FormworkError("READ_ONLY", "字段只读");
              if (disabled()) throw new FormworkError("DISABLED", "字段已禁用");
              nodeProps.scope.set(path!, next);
            },
            get readOnly() {
              return readonly();
            },
            get disabled() {
              return disabled();
            },
            get errors() {
              return errors();
            },
            schema: cell.schema,
            ...("items" in cell.schema ? { array: cell.scope.array(""), Item } : {}),
          }
        : {};
      const dynamicProps = Object.fromEntries(
        Object.keys(evaluated).map((name) => [name, undefined]),
      );
      for (const [name, result] of Object.entries(evaluated))
        Object.defineProperty(dynamicProps, name, { get: result.value, enumerable: true });
      const Children = () => (
        <For each={childViews}>
          {(child) => (
            <Node
              view={child}
              scope={nodeProps.scope}
              base={childBase}
              readOnly={readonly()}
              disabled={disabled()}
            />
          )}
        </For>
      );
      const Content = () =>
        nodeProps.rootContainer && props.container ? (
          <Dynamic component={props.container}>
            <Children />
          </Dynamic>
        ) : (
          <Dynamic component={Component} {...dynamicProps} {...controlled}>
            <Children />
          </Dynamic>
        );
      return (
        <Show when={restrictions.visible?.value() !== false}>
          <Show
            when={cell && path !== ""}
            fallback={
              <>
                <Content />
                <For each={expressionErrors()}>
                  {(error) => (
                    <p role="alert">
                      {error.code}: {error.message}
                    </p>
                  )}
                </For>
              </>
            }
          >
            <Dynamic
              component={fieldContainer}
              path={path!}
              title={cell?.schema.title ?? path!}
              required={
                !!cell?.parent &&
                "properties" in cell.parent.schema &&
                !!cell.parent.schema.required?.includes(cell.segment())
              }
              errors={errors()}
            >
              <Content />
            </Dynamic>
          </Show>
        </Show>
      );
    };
    return <Node view={view} scope={scope} base="" rootContainer />;
  };
}
