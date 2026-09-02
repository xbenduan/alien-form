import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
} from "antd";
import { useEffect, type ReactNode } from "react";
import type { ArrayFieldNode, FormInstance, PrimitiveFieldNode } from "@alien-form/core";
import { useFieldSnapshot, useRegisterField, useSignalValue } from "@alien-form/react";
import type { ComponentProps } from "@binding";
import type { FieldSchema } from "@engine";
import { fieldGridItemStyle, fieldGridStyle, type FieldGridProps } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
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
    gridSpan: field.componentProps().gridSpan,
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
    "gridSpan",
    "columns",
    "gutter",
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
  const controlProps = nativeProps(props);
  return (
    <AntInput.TextArea
      {...controlProps}
      style={{ width: "100%", ...(controlProps.style as object) }}
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

  const controlProps = nativeProps(props);
  return (
    <AntSelect
      {...controlProps}
      allowClear
      style={{ width: "100%", ...(controlProps.style as object) }}
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
  isTable,
  value,
  schema,
  domain,
  gridSpan,
  columns,
  gutter,
}: ComponentProps &
  FieldGridProps & {
    title?: string;
    description?: string;
    isTable?: boolean;
    schema?: FieldSchema;
    domain?: string;
  }) {
  if (isTable) {
    return <TableComplexCell value={value} schema={schema} title={title} domain={domain} />;
  }

  return (
    <ComplexFieldFrame title={title} description={description}>
      <div className={styles.objectField} style={fieldGridStyle({ gridSpan, columns, gutter })}>
        {children}
      </div>
    </ComplexFieldFrame>
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
  const { value, title, description, required, disabled, display, errors, gridSpan } =
    useFieldSnapshot(field, readArrayPrimitiveSnapshot);
  useRegisterField(form, field);

  if (display === "none") return null;
  return (
    <div
      className={styles.arrayField}
      hidden={display === "hidden"}
      style={fieldGridItemStyle(gridSpan)}
    >
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

type ArrayCardsProps = ComponentProps &
  FieldGridProps & {
    title?: string;
    description?: string;
    isTable?: boolean;
    schema?: FieldSchema;
    domain?: string;
  };

function ArrayCardsField({
  form,
  field,
  mode,
  title,
  description,
  gridSpan,
  columns,
  gutter,
}: ArrayCardsProps) {
  const array = field as ArrayFieldNode;
  const rows = useSignalValue(array.rows);
  const readonly = mode === "detail";
  const gridStyle = fieldGridStyle({ gridSpan, columns, gutter });

  return (
    <ComplexFieldFrame title={title} description={description}>
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
              <div className={styles.arrayCardBody} style={gridStyle}>
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
    </ComplexFieldFrame>
  );
}

export function ArrayCards(props: ArrayCardsProps) {
  if (props.isTable) {
    return (
      <TableComplexCell
        value={props.value}
        schema={props.schema}
        title={props.title}
        domain={props.domain}
      />
    );
  }
  return <ArrayCardsField {...props} />;
}
