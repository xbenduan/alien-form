import { defineAdapter } from "@alien-form/cms";
import Select from "./select";

function TestTags(props: {
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

export default defineAdapter(TestTags, {
  key: "TestTags",
  label: "测试标签",
  description: "标签输入组件，基于 Select 的 tags 模式。",
  kind: "component",
  scenes: { recordForm: { mode: "edit" }, recordFilter: { mode: "filter" } },
  meta: { fieldType: "tags" },
});
