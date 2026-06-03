import { defineAdapter } from "@alien-form/cms";
import { Switch as AntSwitch } from "antd";

function Switch({
  value,
  onChange,
  disabled,
}: {
  value?: boolean;
  onChange?: (nextValue: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
}) {
  return (
    <AntSwitch
      checked={Boolean(value)}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled}
    />
  );
}

export default defineAdapter({
  component: Switch,
  config: {
    key: "Switch",
    label: "Switch",
    description: "布尔开关组件。",
    kind: "component",
    scenes: ["recordForm", "recordFilter"],
    meta: { fieldType: "boolean" },
  },
});
