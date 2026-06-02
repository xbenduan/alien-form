import type { DataSourceItem } from "@alien-form/core";
import type { ValueFormat } from "../types/schema";

/**
 * Framework-agnostic formatted result.
 * UI layers convert this to framework-specific nodes (ReactNode, VNode, etc).
 */
export interface FormattedResult {
  /** Plain text representation. */
  text: string;
  /** Semantic type for rendering. */
  type: "plain" | "status" | "date" | "dateTime" | "boolean" | "tags" | "image" | "link";
  /** Semantic color hint: success, warning, error, processing, default. */
  color?: string;
  /** For tags type: individual tag strings. */
  items?: string[];
  /** Raw original value. */
  raw: unknown;
}

function getLabel(value: unknown, dataSource?: DataSourceItem[]): string | undefined {
  return dataSource?.find((item) => item.value === value)?.label;
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

function inferStatusColor(value: unknown): string {
  const key = String(value).toLowerCase();
  return STATUS_COLORS[key] ?? "default";
}

/**
 * Format a value into a framework-agnostic FormattedResult.
 * UI components should consume this and render accordingly.
 */
export function formatValue(
  value: unknown,
  format?: ValueFormat,
  dataSource?: DataSourceItem[],
): FormattedResult {
  if (value === null || value === undefined || value === "") {
    return { text: "\u2014", type: "plain", raw: value };
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => getLabel(item, dataSource) ?? String(item));
    return {
      text: items.length > 0 ? items.join(", ") : "\u2014",
      type: "tags",
      items,
      raw: value,
    };
  }

  if (format === "boolean" || typeof value === "boolean") {
    const boolVal = Boolean(value);
    return {
      text: boolVal ? "Yes" : "No",
      type: "boolean",
      color: boolVal ? "success" : "default",
      raw: value,
    };
  }

  if (format === "status") {
    const label = getLabel(value, dataSource) ?? String(value);
    return {
      text: label,
      type: "status",
      color: inferStatusColor(value),
      raw: value,
    };
  }

  if (format === "date") {
    return {
      text: String(value).slice(0, 10),
      type: "date",
      raw: value,
    };
  }

  if (format === "dateTime") {
    return {
      text: String(value).slice(0, 16).replace("T", " "),
      type: "dateTime",
      raw: value,
    };
  }

  if (format === "image") {
    return { text: String(value), type: "image", raw: value };
  }

  if (format === "link") {
    return { text: String(value), type: "link", raw: value };
  }

  // Default: resolve label from dataSource if available
  const label = getLabel(value, dataSource);
  return {
    text: label ?? String(value),
    type: "plain",
    raw: value,
  };
}
