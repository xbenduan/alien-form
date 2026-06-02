import { Input as AntInput, InputNumber } from 'antd';

const { TextArea } = AntInput;

export function Input({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  type,
  format,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
  format?: string;
}) {
  if (type === 'number') {
    return (
      <InputNumber
        style={{ width: '100%' }}
        value={value as never}
        onChange={(nextValue) => onChange?.(String(nextValue ?? ''))}
        disabled={disabled}
        placeholder={placeholder}
      />
    );
  }

  return (
    <AntInput
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

export function Textarea({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  rows = 4,
  format,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  format?: string;
}) {
  return (
    <TextArea
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  min,
  max,
  format,
}: {
  value?: number;
  onChange?: (nextValue: number | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  format?: string;
}) {
  return (
    <InputNumber
      style={{ width: '100%' }}
      value={value}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
    />
  );
}
