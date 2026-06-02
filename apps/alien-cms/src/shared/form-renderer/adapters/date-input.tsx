import { DatePicker } from 'antd';
import dayjs from 'dayjs';

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
