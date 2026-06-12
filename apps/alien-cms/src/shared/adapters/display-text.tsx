import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Image, Tag, Typography } from "antd";
import { getDisplaySummary } from "./get-display-summary";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

function normalizeArrayItems(value: unknown[], dataSource?: DataSourceItem[]) {
  return value
    .map((item) => {
      if (item === undefined || item === null || item === "") {
        return null;
      }
      return String(dataSource?.find((option) => option.value === item)?.label ?? item);
    })
    .filter((item): item is string => Boolean(item));
}

function renderTagList(items: string[]) {
  if (items.length === 0) {
    return <>—</>;
  }

  return (
    <span className="readonly-tag-list">
      {items.map((item) => (
        <Tag key={item} className="readonly-tag-item">
          {item}
        </Tag>
      ))}
    </span>
  );
}

function renderText(text: string, ellipsis?: boolean) {
  if (!ellipsis && text.length > 120) {
    return (
      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
        {text}
      </Typography.Paragraph>
    );
  }

  if (ellipsis) {
    return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
  }

  return <>{text}</>;
}

function DisplayText({ value, dataSource, format, ellipsis }: DisplayValueProps) {
  const summary = getDisplaySummary({ value, dataSource, format });

  if (summary.kind === "image" && typeof value === "string") {
    return <Image src={value} alt={value} style={{ maxWidth: 160 }} />;
  }

  if (summary.kind === "link" && typeof value === "string") {
    return (
      <Typography.Link href={value} target="_blank" rel="noreferrer">
        {value}
      </Typography.Link>
    );
  }

  if (summary.kind === "status") {
    return <Tag color={summary.color}>{summary.text}</Tag>;
  }

  if (Array.isArray(value)) {
    return renderTagList(normalizeArrayItems(value, dataSource));
  }

  return renderText(summary.text, ellipsis);
}

export default defineAdapter(DisplayText, {
  key: "DisplayText",
  label: "文本展示组件",
  description: "通用只读文本展示组件。",
  kind: "display",
  scenes: { recordDetail: { mode: "readonly" }, tableCell: { mode: "cell" } },
  meta: { displayType: "text" },
});
