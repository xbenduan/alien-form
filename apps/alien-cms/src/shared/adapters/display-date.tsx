import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import DisplayText from "./display-text";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

function DisplayDate(props: DisplayValueProps) {
  return <DisplayText {...props} format={props.format ?? "date"} />;
}

export default defineAdapter(DisplayDate, {
  key: "DisplayDate",
  label: "日期展示",
  description: "日期只读展示组件。",
  kind: "display",
  scenes: ["recordDetail", "tableCell"],
  meta: { displayType: "date" },
});
