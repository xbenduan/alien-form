import type { DataSourceItem } from "@alien-form/react";
import { Tag } from "../ui";
import "./display-utils.css";

export const EMPTY_TEXT = "—";

export function normalizeArrayItems(value: unknown[], dataSource?: DataSourceItem[]): string[] {
  return value
    .map((item) => {
      if (item === undefined || item === null || item === "") {
        return null;
      }
      return String(dataSource?.find((option) => option.value === item)?.label ?? item);
    })
    .filter((item): item is string => Boolean(item));
}

export function renderTagList(items: string[]): React.ReactNode {
  if (items.length === 0) {
    return <>{EMPTY_TEXT}</>;
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
