import { defineAdapter } from "@alien-form/cms";
import { Switch as AntSwitch } from "antd";
import type { BaseFieldProps } from "./types";

function Switch({
  value,
  onChange,
  disabled,
  readOnly,
}: BaseFieldProps & {
  value?: boolean;
  onChange?: (nextValue: boolean) => void;
}) {
  return (
    <AntSwitch
      checked={Boolean(value)}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled || readOnly}
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
