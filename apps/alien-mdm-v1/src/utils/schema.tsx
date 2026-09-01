import { Tag, type TableColumnsType } from "antd";
import type { FieldSchema } from "@engine";

export function schemaToColumns<T extends object = Record<string, unknown>>(
  schema?: FieldSchema,
): TableColumnsType<T> {
  return Object.entries(schema?.properties ?? {})
    .filter(([, field]) => field["x-table"]?.visible !== false)
    .map(([key, field]) => ({
      key,
      dataIndex: key,
      title: field.title ?? key,
      width: field["x-table"]?.width,
      fixed: field["x-table"]?.fixed,
      ellipsis: true,
      render(value: unknown) {
        if (value == null || value === "") return "-";
        if (typeof value === "boolean") {
          return <Tag color={value ? "green" : "default"}>{value ? "是" : "否"}</Tag>;
        }
        if (typeof value === "object") {
          const label = (value as { label?: unknown }).label;
          return String(label ?? JSON.stringify(value));
        }
        return String(value);
      },
    }));
}

export function schemaToFields(schema?: FieldSchema): Array<{
  name: string;
  title: string;
  type?: string;
}> {
  return Object.entries(schema?.properties ?? {}).map(([name, field]) => ({
    name,
    title: field.title ?? name,
    type: field.type,
  }));
}
