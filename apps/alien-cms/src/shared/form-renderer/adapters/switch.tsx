import { Switch as AntSwitch } from 'antd';

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
  return <AntSwitch checked={Boolean(value)} onChange={(nextValue) => onChange?.(nextValue)} disabled={disabled} />;
}
