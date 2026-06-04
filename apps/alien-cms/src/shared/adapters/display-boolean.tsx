import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Typography } from "antd";
import { getDisplaySummary } from "./get-display-summary";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

function DisplayBoolean({ value, ellipsis }: DisplayValueProps) {
  const text = getDisplaySummary({ value, format: "boolean" }).text;
  return ellipsis ? (
    <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>
  ) : (
    <>{text}</>
  );
}

export default defineAdapter(DisplayBoolean, {
  key: "DisplayBoolean",
  label: "开关展示",
  description: "布尔值只读展示组件。",
  kind: "display",
  scenes: ["recordDetail", "tableCell"],
  meta: { displayType: "boolean" },
});
