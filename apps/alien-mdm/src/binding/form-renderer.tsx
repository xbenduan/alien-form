import { compileExpr, type FieldNode, type FormInstance } from "@alien-form/core";
import {
  shallowEqual,
  useFieldSnapshot,
  useRegisterField,
  useSignalSnapshot,
} from "@alien-form/react";
import { Alert } from "antd";
import { Fragment, useCallback, type ComponentType, type ReactNode } from "react";
import { isCompiledValue, type CompiledNode } from "@alien-form/engine";
import { fieldGridItemStyle } from "@utils/field-grid";
import { useRuntime } from "./runtime-provider";
import styles from "./form-renderer.module.css";

export interface ComponentProps {
  form: FormInstance;
  field: FieldNode;
  node: CompiledNode;
  slots: Record<string, ReactNode>;
  children?: ReactNode;
  value?: unknown;
  mode?: string;
  onChange?: (value: unknown) => void;
  dataSource?: unknown[];
  loading?: boolean;
  placeholder?: string;
  [key: string]: unknown;
}

export function fallbackNode(key: string, field: FieldNode): CompiledNode {
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

function containsExpression(value: unknown): boolean {
  if (isCompiledValue(value)) return true;
  if (typeof value === "string")
    return value.trim().startsWith("{{") && value.trim().endsWith("}}");
  if (Array.isArray(value)) return value.some(containsExpression);
  return !!value && typeof value === "object" && Object.values(value).some(containsExpression);
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

function readFieldSnapshot(field: FieldNode) {
  return {
    display: field.display(),
    componentCode: field.component(),
    errors: field.errors(),
    disabled: field.disabled(),
    required: field.required(),
    title: field.title(),
    description: field.description(),
    loading: field.loading(),
    dataSource: field.dataSource(),
    value: field.kind === "primitive" ? field.value() : undefined,
  };
}

function useNodeProps(node: CompiledNode, field: FieldNode, form: FormInstance) {
  const read = useCallback(() => {
    const fieldProps = field.componentProps();
    const effectiveProps = Object.fromEntries(
      Array.from(new Set([...Object.keys(node.props), ...Object.keys(fieldProps)])).map((key) => [
        key,
        fieldProps[key] === node.schema.props?.[key] ? node.props[key] : fieldProps[key],
      ]),
    );
    if (!containsExpression(effectiveProps)) return effectiveProps;

    const value = field.kind === "primitive" ? field.value() : form.project(field.path);
    return evaluateValue(effectiveProps, {
      ...form.scope,
      $values: form.values(),
      $self: field,
      $form: form,
      $value: value,
      $row: rowValues(form, field),
      $path: field.path,
    }) as Record<string, unknown>;
  }, [field, form, node]);
  return useSignalSnapshot(read, shallowEqual);
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
  const {
    display,
    componentCode,
    errors,
    disabled,
    required,
    title,
    description,
    loading,
    dataSource,
    value,
  } = useFieldSnapshot(field, readFieldSnapshot);
  const props = useNodeProps(node, field, form);
  useRegisterField(form, field);
  const mode = typeof form.scope.mode === "string" ? form.scope.mode : undefined;

  if (display === "none") return null;
  const registration = runtime.resolveComponent(componentCode, domain);
  if (!registration) {
    return <Alert type="error" message={`Component not registered: ${componentCode}`} />;
  }

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
      ? {
          ...props,
          id: props.id ?? field.id,
          disabled,
          loading,
          value,
          dataSource,
          "aria-invalid": errors.length > 0,
          "aria-describedby": errors.length ? `${field.id}-error` : undefined,
          onChange: field.setValue,
        }
      : props;
  const renderedChildren = children.length ? children : undefined;
  const alienProps =
    registration.adapter !== "antd"
      ? { ...controlProps, form, field, node, slots, mode, value, title, description, domain }
      : controlProps;
  const control = renderedChildren ? (
    <Component {...alienProps}>{renderedChildren}</Component>
  ) : (
    <Component {...alienProps} />
  );

  if (field.kind !== "primitive") return control;
  const showRequired = mode !== "detail" && required;
  return (
    <div
      className={`${styles.formItem}${mode === "detail" ? ` ${styles.detailFormItem}` : ""}`}
      hidden={display === "hidden"}
      style={fieldGridItemStyle(props.gridSpan)}
    >
      {title ? (
        <label
          className={`${styles.formItemLabel}${showRequired ? ` ${styles.required}` : ""}`}
          htmlFor={field.id}
        >
          {title}
        </label>
      ) : null}
      <div className={styles.formItemControl}>{control}</div>
      {description ? <div className={styles.formItemDescription}>{description}</div> : null}
      {errors[0]?.message ? (
        <div id={`${field.id}-error`} className={styles.formItemError} role="alert">
          {errors[0].message}
        </div>
      ) : null}
    </div>
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
  const renderNodes =
    nodes ?? Array.from(form.root.children, ([key, field]) => fallbackNode(key, field));
  return (
    <div className={styles.form} data-alien-form>
      {renderNodes.map((node) => {
        const field = form.root.children.get(node.key);
        return field ? (
          <RenderNode key={field.id} node={node} field={field} form={form} domain={domain} />
        ) : (
          <Fragment key={node.key} />
        );
      })}
    </div>
  );
}
