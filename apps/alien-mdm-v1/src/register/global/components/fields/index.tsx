import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
  Switch as AntSwitch,
} from "antd";
import { useEffect, type ReactNode } from "react";
import type { ArrayFieldNode, FormInstance, PrimitiveFieldNode } from "@alien-form/core";
import { useFieldSnapshot, useRegisterField, useSignalValue } from "@alien-form/react";
import type { ComponentProps } from "@binding";
import styles from "./index.module.css";

function displayValue(value: unknown): ReactNode {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DetailValue({ value }: { value: unknown }) {
  return <div className={styles.detailValue}>{displayValue(value)}</div>;
}

function readArrayPrimitiveSnapshot(field: PrimitiveFieldNode) {
  return {
    value: field.value(),
    title: field.title(),
    description: field.description(),
    required: field.required(),
    disabled: field.disabled(),
    display: field.display(),
    errors: field.errors(),
  };
}

function nativeProps(props: ComponentProps): Record<string, unknown> {
  const result = { ...props };
  for (const key of [
    "value",
    "onChange",
    "mode",
    "form",
    "field",
    "node",
    "slots",
    "children",
    "dataSource",
    "loading",
    "title",
    "description",
  ]) {
    delete result[key];
  }
  return result;
}

export function Input(props: ComponentProps) {
  if (props.mode === "detail") return <DetailValue value={props.value} />;
  return (
    <AntInput
      {...nativeProps(props)}
      value={props.value as string | undefined}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  );
}

export function TextArea(props: ComponentProps) {
  if (props.mode === "detail") return <DetailValue value={props.value} />;
  return (
    <AntInput.TextArea
      {...nativeProps(props)}
      value={props.value as string | undefined}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  );
}

export function NumberInput(props: ComponentProps) {
  if (props.mode === "detail") return <DetailValue value={props.value} />;
  const controlProps = nativeProps(props);
  return (
    <AntInputNumber
      {...controlProps}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={props.value as number | null | undefined}
      onChange={(next) => props.onChange?.(next)}
    />
  );
}

export function Switch(props: ComponentProps) {
  if (props.mode === "detail") return <DetailValue value={props.value} />;
  return (
    <AntSwitch
      {...nativeProps(props)}
      checked={Boolean(props.value)}
      onChange={(next) => props.onChange?.(next)}
    />
  );
}

export function Select(
  props: ComponentProps & { onOptionsChange?: "preserve" | "clear" | "first" },
) {
  const { value, onChange, dataSource = [], loading, onOptionsChange = "clear" } = props;
  useEffect(() => {
    if (props.mode === "detail" || loading || value == null || onOptionsChange === "preserve") {
      return;
    }
    const options = dataSource as Array<{ value: unknown }>;
    if (options.some((option) => Object.is(option.value, value))) return;
    onChange?.(onOptionsChange === "first" ? options[0]?.value : undefined);
  }, [dataSource, loading, onChange, onOptionsChange, props.mode, value]);

  if (props.mode === "detail") {
    const option = (dataSource as Array<{ label?: ReactNode; value: unknown }>).find((item) =>
      Object.is(item.value, value),
    );
    return <DetailValue value={option?.label ?? value} />;
  }

  return (
    <AntSelect
      {...nativeProps(props)}
      allowClear
      value={value}
      options={dataSource as any[]}
      loading={loading}
      onChange={(next) => onChange?.(next)}
    />
  );
}

export function ObjectField({
  children,
  title,
  description,
}: ComponentProps & { title?: string; description?: string }) {
  return (
    <fieldset className={styles.complexField}>
      {title ? <legend className={styles.complexFieldTitle}>{title}</legend> : null}
      {description ? <div className={styles.complexFieldDescription}>{description}</div> : null}
      <div className={styles.complexFieldBody}>
        <div className={styles.objectField}>{children}</div>
      </div>
    </fieldset>
  );
}

function ArrayPrimitiveField({
  form,
  field,
  fieldKey,
  readonly,
}: {
  form: FormInstance;
  field: PrimitiveFieldNode;
  fieldKey: string;
  readonly: boolean;
}) {
  const { value, title, description, required, disabled, display, errors } = useFieldSnapshot(
    field,
    readArrayPrimitiveSnapshot,
  );
  useRegisterField(form, field);

  if (display === "none") return null;
  return (
    <div className={styles.arrayField} hidden={display === "hidden"}>
      <label
        className={`${styles.arrayFieldLabel}${readonly ? ` ${styles.arrayFieldDetail}` : ""}${
          !readonly && required ? ` ${styles.arrayFieldRequired}` : ""
        }`}
        htmlFor={field.id}
      >
        {title ?? fieldKey}
      </label>
      {readonly ? (
        <DetailValue value={value} />
      ) : (
        <AntInput
          id={field.id}
          value={value as string | undefined}
          disabled={disabled}
          aria-invalid={errors.length > 0}
          aria-describedby={errors.length ? `${field.id}-error` : undefined}
          onChange={(event) => field.setValue(event.target.value)}
        />
      )}
      {description ? <div className={styles.arrayFieldDescription}>{description}</div> : null}
      {errors[0]?.message ? (
        <div id={`${field.id}-error`} className={styles.arrayFieldError} role="alert">
          {errors[0].message}
        </div>
      ) : null}
    </div>
  );
}

export function ArrayCards({
  form,
  field,
  mode,
  title,
  description,
}: ComponentProps & { title?: string; description?: string }) {
  const array = field as ArrayFieldNode;
  const rows = useSignalValue(array.rows);
  const readonly = mode === "detail";

  return (
    <fieldset className={styles.complexField}>
      {title ? <legend className={styles.complexFieldTitle}>{title}</legend> : null}
      {description ? <div className={styles.complexFieldDescription}>{description}</div> : null}
      <div className={styles.complexFieldBody}>
        {rows.length === 0 ? (
          <>
            <Empty description="暂无数据" style={{ paddingBlock: 16 }} />
            {readonly ? null : (
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => array.push({})}>
                添加一行
              </Button>
            )}
          </>
        ) : (
          <div className={styles.arrayCards}>
            {rows.map((row, index) => (
              <div className={styles.arrayCard} key={row.id}>
                <div className={styles.arrayCardHeader}>
                  <span className={styles.arrayCardIndex}>#{index + 1}</span>
                  {readonly ? null : (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="删除"
                      onClick={() => array.remove(index)}
                    />
                  )}
                </div>
                <div className={styles.arrayCardBody}>
                  {Array.from(row.children, ([key, child]) => {
                    if (child.kind !== "primitive") return null;
                    return (
                      <ArrayPrimitiveField
                        key={child.id}
                        form={form}
                        field={child as PrimitiveFieldNode}
                        fieldKey={key}
                        readonly={readonly}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {readonly ? null : (
              <Button
                className={styles.arrayCardAdd}
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => array.push({})}
              >
                添加一行
              </Button>
            )}
          </div>
        )}
      </div>
    </fieldset>
  );
}
