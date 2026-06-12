import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Radio as AntRadio } from "antd";
import type { BaseFieldProps } from "./types";

function Radio({
  value,
  onChange,
  disabled,
  readOnly,
  dataSource = [],
}: BaseFieldProps & {
  onChange?: (nextValue: unknown) => void;
  dataSource?: DataSourceItem[];
}) {
  return (
    <AntRadio.Group
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled || readOnly}
    >
      {dataSource.map((item) => (
        <AntRadio key={String(item.value)} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}

export default defineAdapter(Radio, {
  key: "Radio",
  label: "单选组件",
  description: "单选组件。",
  kind: "component",
  scenes: { recordForm: { mode: "edit" }, recordFilter: { mode: "filter" }, recordDetail: { renderAs: "DisplayChoice" }, tableCell: { renderAs: "DisplayChoice", summary: true } },
  meta: { fieldType: "string" },
});
