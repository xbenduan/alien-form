import { DatePicker } from 'antd';
import dayjs from 'dayjs';

export function DateInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
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
