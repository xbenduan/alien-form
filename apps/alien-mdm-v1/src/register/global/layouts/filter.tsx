import { SearchOutlined } from "@ant-design/icons";
import { Button, Card, Input, Space } from "antd";
import { useEffect, useState } from "react";
import { usePage, type ComponentProps } from "@binding";
import type { FieldSchema } from "@engine";
import { parseFilter } from "./parse-filter";
import styles from "./index.module.css";

interface FilterField {
  name: string;
  title: string;
  type?: string;
}

export function Filter({
  value,
  onChange,
  schema,
  fields: toFields,
  defaultValue,
}: ComponentProps & {
  schema?: FieldSchema;
  fields?: (schema?: FieldSchema) => FilterField[];
  defaultValue?: unknown;
}) {
  const page = usePage();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    parseFilter(value ?? defaultValue),
  );
  const fields = toFields?.(schema) ?? [];
  const visibleCount = Math.max(1, page.model.meta.filterCount ?? 4);
  const hasExtraFields = fields.length > visibleCount;

  useEffect(() => {
    setDraft(parseFilter(value ?? defaultValue));
  }, [value, defaultValue]);

  const update = (key: string, next: string) => {
    setDraft((current) => ({ ...current, [key]: next || undefined }));
  };
  const reset = () => {
    setDraft({});
    onChange?.("{}");
  };

  return (
    <Card className={styles.filterCard} styles={{ body: { padding: 16 } }}>
      <div className={styles.filter}>
        <div className={styles.filterFields}>
          {fields.map((field, index) => (
            <label
              key={field.name}
              className={styles.filterField}
              style={!expanded && index >= visibleCount ? { display: "none" } : undefined}
            >
              <span className={styles.filterLabel}>{field.title}</span>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={`请输入${field.title}`}
                value={String(draft[field.name] ?? "")}
                onChange={(event) => update(field.name, event.target.value)}
                onPressEnter={() => onChange?.(JSON.stringify(draft))}
              />
            </label>
          ))}
        </div>
        <div className={styles.filterActions}>
          <Space>
            {hasExtraFields && (
              <Button type="link" onClick={() => setExpanded((current) => !current)}>
                {expanded ? "收起" : "展开"}
              </Button>
            )}
            <Button onClick={reset}>重置</Button>
            <Button type="primary" onClick={() => onChange?.(JSON.stringify(draft))}>
              查询
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}
