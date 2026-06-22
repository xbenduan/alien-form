import { defineAdapter } from "@alien-form/cms";
import { Typography } from "antd";
import { getDisplaySummary } from "./get-display-summary";

function DisplayBoolean({ value, ellipsis }: { value?: unknown; ellipsis?: boolean }) {
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
  scenes: { detail: {}, table: {} },
  meta: { displayType: "boolean" },
});
