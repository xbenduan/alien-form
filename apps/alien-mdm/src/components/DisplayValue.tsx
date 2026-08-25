import { Image, Tag, Typography } from "antd";
import type { DataSourceItem } from "@alien-form/react";
import { EMPTY_TEXT, isEmptyValue, optionLabel, refValue, statusColor } from "../compiler";

export interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: "text" | "date" | "dateTime" | "status" | "boolean" | "image" | "link";
  ellipsis?: boolean;
}

function toDateText(value: unknown, withTime: boolean): string {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? new Date(value).toISOString()
      : String(value);
  return withTime ? raw.slice(0, 16).replace("T", " ") : raw.slice(0, 10);
}

/** 通用只读展示：叶子字段在 detail / table 下统一走这里。 */
export function DisplayValue({ value, dataSource, format, ellipsis }: DisplayValueProps) {
  if (isEmptyValue(value)) return <>{EMPTY_TEXT}</>;

  if (Array.isArray(value)) {
    const items = value
      .filter((item) => !isEmptyValue(item))
      .map((item) => optionLabel(item, dataSource));
    if (items.length === 0) return <>{EMPTY_TEXT}</>;
    return (
      <span className="af-tag-list">
        {items.map((item, index) => (
          <Tag key={`${item}:${index}`} className="af-tag-item">
            {item}
          </Tag>
        ))}
      </span>
    );
  }

  if (format === "boolean" || typeof value === "boolean") {
    return <>{value ? "是" : "否"}</>;
  }
  if (format === "status") {
    const text = optionLabel(value, dataSource);
    return <Tag color={statusColor(refValue(value))}>{text}</Tag>;
  }
  if (format === "date") return <>{toDateText(value, false)}</>;
  if (format === "dateTime") return <>{toDateText(value, true)}</>;
  if (format === "image" && typeof value === "string") {
    return <Image src={value} alt={value} style={{ maxWidth: 160 }} />;
  }
  if (format === "link" && typeof value === "string") {
    return (
      <Typography.Link href={value} target="_blank" rel="noreferrer">
        {value}
      </Typography.Link>
    );
  }

  const text = optionLabel(value, dataSource);
  return ellipsis ? (
    <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>
  ) : (
    <>{text}</>
  );
}
