import { compileExpr, type FieldNode, type FormInstance } from "@alien-form/core";
import { Alert, Form } from "antd";
import { Fragment, useEffect, type ComponentType, type ReactNode } from "react";
import { isCompiledValue, type CompiledNode } from "@engine";
import { useRuntime } from "./runtime-provider";
import { useAtom } from "./use-atom";

const emptyValue = () => undefined;

export interface ComponentProps {
  field: FieldNode;
  node: CompiledNode;
  slots: Record<string, ReactNode>;
  children?: ReactNode;
  value?: unknown;
  onChange?: (value: unknown) => void;
  dataSource?: unknown[];
  loading?: boolean;
  [key: string]: unknown;
}

function fallbackNode(key: string, field: FieldNode): CompiledNode {
  const children =
    field.kind === "object" || field.kind === "void"
      ? Array.from(field.children, ([childKey, child]) => fallbackNode(childKey, child))
      : [];
  return {
    key,
    schema: field.schema,
    props: field.schema.props ?? {},
    slots: {},
    children,
  };
}

function evaluateValue(value: unknown, scope: Record<string, unknown>): unknown {
  if (isCompiledValue(value)) return value.expression(scope as any);
  if (typeof value === "string" && value.trim().startsWith("{{") && value.trim().endsWith("}}")) {
    return compileExpr(value)(scope as any);
  }
  if (Array.isArray(value)) return value.map((item) => evaluateValue(item, scope));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, evaluateValue(child, scope)]),
  );
}

function rowValues(form: FormInstance, field: FieldNode): Record<string, unknown> | undefined {
  if (!field.row) return undefined;
  return Object.fromEntries(
    Array.from(field.row.children, ([key, child]) => [key, form.project(child.path)]),
  );
}

function childField(field: FieldNode, key: string): FieldNode | undefined {
  if (field.kind !== "object" && field.kind !== "void") return undefined;
  return field.children.get(key);
}

export function RenderNode({
  node,
  field,
  form,
  domain,
}: {
  node: CompiledNode;
  field: FieldNode;
  form: FormInstance;
  domain?: string;
}) {
  const runtime = useRuntime();
  const display = useAtom(field.display as () => "visible" | "hidden" | "none");
  const componentCode = useAtom(field.component as () => string);
  const fieldProps = useAtom(field.componentProps as () => Record<string, unknown>);
  const values = useAtom(form.values as () => Record<string, unknown>);
  const errors = useAtom(field.errors as () => Array<{ message: string }>);
  const disabled = useAtom(field.disabled as () => boolean);
  const required = useAtom(field.required as () => boolean);
  const title = useAtom(field.title as () => string | undefined);
  const loading = useAtom(field.loading as () => boolean);
  const dataSource = useAtom(field.dataSource as () => unknown[]);
  const value = useAtom((field.kind === "primitive" ? field.value : emptyValue) as () => unknown);

  if (display === "none") return null;
  const registration = runtime.resolveComponent(componentCode, domain);
  if (!registration) {
    return <Alert type="error" message={`Component not registered: ${componentCode}`} />;
  }

  const scope = {
    ...form.scope,
    $values: values,
    $self: field,
    $form: form,
    $value: value,
    $row: rowValues(form, field),
    $path: field.path,
  };
  const effectiveProps = Object.fromEntries(
    Array.from(new Set([...Object.keys(node.props), ...Object.keys(fieldProps)])).map((key) => [
      key,
      fieldProps[key] === node.schema.props?.[key] ? node.props[key] : fieldProps[key],
    ]),
  );
  const props = evaluateValue(effectiveProps, scope) as Record<string, unknown>;
  const slotted = new Set<CompiledNode>();
  const slots = Object.fromEntries(
    Object.entries(node.slots).map(([name, slot]) => {
      const nodes = Array.isArray(slot) ? slot : [slot];
      nodes.forEach((child) => slotted.add(child));
      return [
        name,
        nodes.map((child) => {
          const target = childField(field, child.key);
          return target ? (
            <RenderNode key={target.id} node={child} field={target} form={form} domain={domain} />
          ) : null;
        }),
      ];
    }),
  );
  const children = node.children
    .filter((child) => !slotted.has(child))
    .map((child) => {
      const target = childField(field, child.key);
      return target ? (
        <RenderNode key={target.id} node={child} field={target} form={form} domain={domain} />
      ) : null;
    });
  const Component = registration.component as ComponentType<any>;
  const controlProps =
    field.kind === "primitive"
      ? { ...props, disabled, loading, value, dataSource, onChange: field.setValue }
      : props;
  const renderedChildren = children.length ? children : undefined;
  const alienProps =
    registration.adapter === "alien" ? { ...controlProps, field, node, slots } : controlProps;
  const control = renderedChildren ? (
    <Component {...alienProps}>{renderedChildren}</Component>
  ) : (
    <Component {...alienProps} />
  );

  if (field.kind !== "primitive") return control;
  return (
    <Form.Item
      label={title}
      required={required}
      validateStatus={errors.length ? "error" : undefined}
      help={errors[0]?.message}
      hidden={display === "hidden"}
    >
      {control}
    </Form.Item>
  );
}

export function FormRenderer({
  form,
  nodes,
  domain,
}: {
  form: FormInstance;
  nodes?: CompiledNode[];
  domain?: string;
}) {
  useEffect(() => {
    form.mount();
    return () => form.unmount();
  }, [form]);

  const renderNodes =
    nodes ?? Array.from(form.root.children, ([key, field]) => fallbackNode(key, field));
  return (
    <Form layout="vertical">
      {renderNodes.map((node) => {
        const field = form.root.children.get(node.key);
        return field ? (
          <RenderNode key={field.id} node={node} field={field} form={form} domain={domain} />
        ) : (
          <Fragment key={node.key} />
        );
      })}
    </Form>
  );
}
