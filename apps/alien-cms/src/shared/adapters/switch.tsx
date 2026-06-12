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

export default defineAdapter(Switch, {
  key: "Switch",
  label: "开关",
  description: "布尔开关组件。",
  kind: "component",
  scenes: {
    recordForm: { mode: "edit" },
    recordFilter: {
      renderAs: "Select",
      operator: "eq",
      props: {
        dataSource: [
          { label: "是", value: true },
          { label: "否", value: false },
        ],
      },
    },
    recordDetail: { renderAs: "DisplayBoolean" },
    tableCell: { renderAs: "DisplayBoolean", summary: true },
  },
  meta: { fieldType: "boolean" },
});
