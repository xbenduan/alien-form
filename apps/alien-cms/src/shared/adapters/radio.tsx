import type { DataSourceItem } from "@alien-form/react";
import { Radio as AntRadio } from "../ui";
import type { BaseFieldProps } from "./types";

export function Radio({
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

export default Radio;
