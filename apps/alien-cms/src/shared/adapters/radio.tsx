import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Radio as AntRadio } from "antd";

function Radio({
  value,
  onChange,
  disabled,
  dataSource = [],
}: {
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
  readOnly?: boolean;
  format?: string;
}) {
  return (
    <AntRadio.Group
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
    >
      {dataSource.map((item) => (
        <AntRadio key={String(item.value)} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}

export default defineAdapter(
  Radio,
  {
    key: "Radio",
    label: "Radio",
    description: "单选组件。",
    kind: "component",
    scenes: ["recordForm", "recordFilter"],
    meta: { fieldType: "string" },
  },
);
