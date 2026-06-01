import { Switch as AntSwitch } from 'antd';

export function Switch({
  value,
  onChange,
  disabled,
}: {
  value?: boolean;
  onChange?: (nextValue: boolean) => void;
  disabled?: boolean;
}) {
  return <AntSwitch checked={Boolean(value)} onChange={(nextValue) => onChange?.(nextValue)} disabled={disabled} />;
}
