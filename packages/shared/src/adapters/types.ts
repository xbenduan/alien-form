import type { DataSourceItem } from "@alien-form/react";

export interface BaseFieldProps {
  value?: unknown;
  onChange?: (nextValue: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

export interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}
