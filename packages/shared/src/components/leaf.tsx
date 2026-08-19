import {
  DatePicker,
  Input as AntInput,
  InputNumber,
  Radio as AntRadio,
  Rate as AntRate,
  Select as AntSelect,
  Switch as AntSwitch,
  Checkbox,
} from "antd";
import dayjs from "dayjs";
import type { FieldComponentProps } from "../types";
import { useFieldMode } from "./field-mode";
import { DisplayValue } from "./DisplayValue";
import { parseMultiValue, serializeMultiValue } from "../utils/multi-value";

const { TextArea } = AntInput;

// ─── Input ──────────────────────────────────────────────────────────────────

export function Input(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} ellipsis />;
  return (
    <AntInput
      value={(props.value as string) ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}

export function Textarea(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} />;
  const rows = typeof props.rows === "number" ? props.rows : 4;
  return (
    <TextArea
      value={(props.value as string) ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      rows={rows}
    />
  );
}

export function NumberInput(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} />;
  return (
    <InputNumber
      style={{ width: "100%" }}
      value={props.value as number}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      min={props.min as number | undefined}
      max={props.max as number | undefined}
    />
  );
}

// ─── Select（单值） ───────────────────────────────────────────────────────────

export function Select(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={props.dataSource} format="status" />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={props.value}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading}
      placeholder={props.placeholder}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}

// ─── MultiSelect / TagsInput（多值，内部承载 JSON 字符串） ─────────────────────

function MultiValueSelect(props: FieldComponentProps & { tags?: boolean }) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={props.dataSource} />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.tags ? "tags" : "multiple"}
      value={items}
      // 叶子字段只接受基元，多值序列化为 JSON 字符串承载（x-format 在投影时还原为数组）
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      loading={props.loading}
      placeholder={props.placeholder}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}

export function MultiSelect(props: FieldComponentProps) {
  return <MultiValueSelect {...props} />;
}

export function TagsInput(props: FieldComponentProps) {
  return <MultiValueSelect {...props} tags />;
}

// ─── DateInput ────────────────────────────────────────────────────────────────

export function DateInput(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} format="date" />;
  return (
    <DatePicker
      style={{ width: "100%" }}
      value={props.value ? dayjs(props.value as string) : null}
      onChange={(_, dateString) => props.onChange?.(String(dateString))}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}

// ─── Switch ─────────────────────────────────────────────────────────────────

export function Switch(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} format="boolean" />;
  return (
    <AntSwitch
      checked={Boolean(props.value)}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
    />
  );
}

// ─── Radio ──────────────────────────────────────────────────────────────────

export function Radio(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={props.dataSource} />;
  }
  return (
    <AntRadio.Group
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
    >
      {(props.dataSource ?? []).map((item) => (
        <AntRadio key={String(item.value)} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}

// ─── CheckboxGroup（多值） ────────────────────────────────────────────────────

export function CheckboxGroup(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={props.dataSource} />;
  }
  return (
    <Checkbox.Group
      value={items as (string | number)[]}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}

// ─── Rate ───────────────────────────────────────────────────────────────────

export function Rate(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    const value = typeof props.value === "number" ? props.value : Number(props.value);
    return <AntRate disabled value={Number.isNaN(value) ? 0 : value} />;
  }
  return (
    <AntRate
      value={props.value as number}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
    />
  );
}
