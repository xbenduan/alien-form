import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Rate } from "antd";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

function DisplayRate({ value }: DisplayValueProps) {
  if (value === undefined || value === null || value === "") {
    return <>—</>;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return <>{String(value)}</>;
  }

  return <Rate disabled value={numericValue} />;
}

export default defineAdapter(DisplayRate, {
  key: "DisplayRate",
  label: "DisplayRate",
  description: "评分只读展示组件。",
  kind: "display",
  scenes: ["recordDetail", "tableCell"],
  meta: { displayType: "rate" },
});
