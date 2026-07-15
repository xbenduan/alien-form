import type { DataSourceItem } from "@alien-form/react";
import Select from "./select";
import type { BaseFieldProps } from "./types";

export function TagsInput(
  props: BaseFieldProps & {
    onChange?: (nextValue: unknown) => void;
    loading?: boolean;
    dataSource?: DataSourceItem[];
  },
) {
  return <Select {...props} mode="tags" />;
}

export default TagsInput;
