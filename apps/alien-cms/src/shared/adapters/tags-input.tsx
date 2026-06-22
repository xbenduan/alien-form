import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import Select from "./select";
import type { BaseFieldProps } from "./types";

function TagsInput(
  props: BaseFieldProps & {
    onChange?: (nextValue: unknown) => void;
    loading?: boolean;
    dataSource?: DataSourceItem[];
  },
) {
  return <Select {...props} mode="tags" />;
}

export default defineAdapter(TagsInput, {
  key: "TagsInput",
  label: "标签输入",
  description: "标签输入组件，基于 Select 的 tags 模式。",
  kind: "component",
  scenes: { form: {}, filter: {}, detail: "DisplayTags", table: { renderAs: "DisplayTags", summary: true } },
  meta: { fieldType: "tags" },
});
