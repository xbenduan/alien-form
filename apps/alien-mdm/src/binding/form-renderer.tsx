import type { FieldNode, FormInstance } from "@alien-form/core";
import { useFieldSnapshot, useRegisterField } from "@alien-form/react";
import { useCallback, type ReactNode } from "react";
import type { CompiledNode } from "@alien-form/engine";
import { fieldGridItemStyle } from "@utils/field-grid";
import { RuntimeComponent, useCompiledProps } from "./runtime-component";
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

function rowValues(form: FormInstance, field: FieldNode): Record<string, unknown> | undefined {
  if (!field.row) return undefined;
  return Object.fromEntries(
    Array.from(field.row.children, ([key, child]) => [key, form.project(child.path)]),
  );
}

function childField(field: FieldNode, key: string): FieldNode {
  if (field.kind !== "object" && field.kind !== "void") {
    throw new Error(`Field cannot contain compiled children: ${field.path}`);
  }
  const child = field.children.get(key);
  if (!child) throw new Error(`Compiled child field not found: ${field.path}.${key}`);
  return child;
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
  const props = useCallback(() => {
    const fieldProps = field.componentProps();
    return Object.fromEntries(
      Array.from(new Set([...Object.keys(node.props), ...Object.keys(fieldProps)])).map((key) => [
        key,
        fieldProps[key] === node.schema.props?.[key] ? node.props[key] : fieldProps[key],
      ]),
    );
  }, [field, node]);
  const scope = useCallback(() => {
    const value = field.kind === "primitive" ? field.value() : form.project(field.path);
    return {
      ...form.scope,
      $values: form.values(),
      $self: field,
      $form: form,
      $value: value,
      $row: rowValues(form, field),
      $path: field.path,
    };
  }, [field, form, node]);
  return useCompiledProps(props, scope);
}

export function FieldRenderer({
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

  const slotted = new Set<CompiledNode>();
  const slots = Object.fromEntries(
    Object.entries(node.slots).map(([name, slot]) => {
      const nodes = Array.isArray(slot) ? slot : [slot];
      nodes.forEach((child) => slotted.add(child));
      return [
        name,
        nodes.map((child) => {
          const target = childField(field, child.key);
          return (
            <FieldRenderer
              key={target.id}
              node={child}
              field={target}
              form={form}
              domain={domain}
            />
          );
        }),
      ];
    }),
  );
  const children = node.children
    .filter((child) => !slotted.has(child))
    .map((child) => {
      const target = childField(field, child.key);
      return (
        <FieldRenderer key={target.id} node={child} field={target} form={form} domain={domain} />
      );
    });
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
  const control = (
    <RuntimeComponent
      code={componentCode}
      domain={domain}
      props={controlProps}
      context={{ form, field, node, slots, mode, value, title, description, domain }}
    >
      {renderedChildren}
    </RuntimeComponent>
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

export function FieldNodes({
  nodes,
  fields,
  form,
  domain,
}: {
  nodes: CompiledNode[];
  fields: ReadonlyMap<string, FieldNode>;
  form: FormInstance;
  domain?: string;
}) {
  return nodes.map((node) => {
    const field = fields.get(node.key);
    if (!field) throw new Error(`Compiled field not found: ${node.key}`);
    return <FieldRenderer key={field.id} node={node} field={field} form={form} domain={domain} />;
  });
}

export function FormRenderer({
  form,
  nodes,
  domain,
}: {
  form: FormInstance;
  nodes: CompiledNode[];
  domain?: string;
}) {
  return (
    <div className={styles.form} data-alien-form>
      <FieldNodes nodes={nodes} fields={form.root.children} form={form} domain={domain} />
    </div>
  );
}
