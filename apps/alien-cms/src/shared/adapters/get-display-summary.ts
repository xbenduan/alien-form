import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";

const EMPTY_TEXT = "—";

export interface DisplaySummary {
  text: string;
  kind: "plain" | "status" | "image" | "link";
  color?: string;
  fullText?: string;
  expandable?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  review: "processing",
  pending: "processing",
  published: "success",
  active: "success",
  archived: "warning",
  disabled: "warning",
  error: "error",
  failed: "error",
  deleted: "error",
};

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function getChoiceLabel(value: unknown, dataSource?: DataSourceItem[]) {
  return dataSource?.find((item) => item.value === value)?.label;
}

function inferStatusColor(value: unknown) {
  return STATUS_COLORS[String(value).toLowerCase()] ?? "default";
}

function normalizeDateValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return String(value);
}

function formatDateText(value: unknown, withTime: boolean) {
  const text = normalizeDateValue(value);
  return withTime ? text.slice(0, 16).replace("T", " ") : text.slice(0, 10);
}

function normalizeArrayItems(value: unknown[], dataSource?: DataSourceItem[]) {
  return value
    .map((item) => {
      if (isEmptyValue(item)) {
        return null;
      }
      return String(getChoiceLabel(item, dataSource) ?? item);
    })
    .filter((item): item is string => Boolean(item));
}

export function getDisplaySummary({
  value,
  dataSource,
  format,
}: {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
}): DisplaySummary {
  if (isEmptyValue(value)) {
    return {
      text: EMPTY_TEXT,
      kind: "plain",
      fullText: EMPTY_TEXT,
      expandable: false,
    };
  }

  if (Array.isArray(value)) {
    const items = normalizeArrayItems(value, dataSource);
    const text = items.length > 0 ? items.join(", ") : EMPTY_TEXT;
    return {
      text,
      kind: "plain",
      fullText: text,
      expandable: items.length > 1 || text.length > 24,
    };
  }

  if (format === "status") {
    const text = String(getChoiceLabel(value, dataSource) ?? value);
    return {
      text,
      kind: "status",
      color: inferStatusColor(value),
      fullText: text,
      expandable: false,
    };
  }

  if (format === "image" && typeof value === "string") {
    return {
      text: value,
      kind: "image",
      fullText: value,
      expandable: true,
    };
  }

  if (format === "link" && typeof value === "string") {
    return {
      text: value,
      kind: "link",
      fullText: value,
      expandable: value.length > 24,
    };
  }

  if (format === "date") {
    const text = formatDateText(value, false);
    return {
      text,
      kind: "plain",
      fullText: text,
      expandable: false,
    };
  }

  if (format === "dateTime") {
    const text = formatDateText(value, true);
    return {
      text,
      kind: "plain",
      fullText: text,
      expandable: false,
    };
  }

  if (typeof value === "boolean" || format === "boolean") {
    const text = value ? "是" : "否";
    return {
      text,
      kind: "plain",
      fullText: text,
      expandable: false,
    };
  }

  const text = String(getChoiceLabel(value, dataSource) ?? value);
  return {
    text,
    kind: "plain",
    fullText: text,
    expandable: text.length > 24,
  };
}

export default defineAdapter(getDisplaySummary, {
  key: "getDisplaySummary",
  label: "getDisplaySummary",
  description: "根据值和 format 计算展示摘要。",
  kind: "utility",
  scenes: { recordDetail: {}, tableCell: {} },
  meta: { utility: true },
});
