import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { FormatValue } from './format-value';

export function DateInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  format,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  format?: string;
}) {
  if (readOnly) {
    return <FormatValue value={value} format={format ?? 'date'} />;
  }

  return (
    <DatePicker
      style={{ width: '100%' }}
      value={value ? dayjs(value) : null}
      onChange={(_, dateString) => onChange?.(String(dateString))}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
