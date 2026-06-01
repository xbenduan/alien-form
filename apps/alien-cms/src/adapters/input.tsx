import { Input as AntInput, InputNumber } from 'antd';

const { TextArea } = AntInput;

export function Input({
  value,
  onChange,
  disabled,
  placeholder,
  type,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
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
  placeholder,
  rows = 4,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
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
  placeholder,
  min,
  max,
}: {
  value?: number;
  onChange?: (nextValue: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
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
