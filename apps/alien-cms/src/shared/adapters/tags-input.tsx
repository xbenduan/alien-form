import { defineAdapter } from "@alien-form/cms";
import Select from "./select";

function TagsInput(props: {
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: Array<{ label: string; value: string | number }>;
  readOnly?: boolean;
  placeholder?: string;
  format?: string;
}) {
  return <Select {...props} mode="tags" />;
}

export default defineAdapter(
  TagsInput,
  {
    key: "TagsInput",
    label: "TagsInput",
    description: "标签输入组件，基于 Select 的 tags 模式。",
    kind: "component",
    scenes: ["recordForm", "recordFilter"],
    meta: { fieldType: "tags" },
  },
);
