import { Switch as AntSwitch } from 'antd';
import { FormatValue } from './format-value';

export function Switch({
  value,
  onChange,
  disabled,
  readOnly,
  format,
}: {
  value?: boolean;
  onChange?: (nextValue: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
}) {
  if (readOnly) {
    return <FormatValue value={value} format={format ?? 'boolean'} />;
  }

  return <AntSwitch checked={Boolean(value)} onChange={(nextValue) => onChange?.(nextValue)} disabled={disabled} />;
}
