import { Button, Card, Space } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePage, type ComponentProps, type ValueSource } from "@binding";
import type { DatabaseField, FieldSchema } from "@alien-form/engine";
import type { FilterField } from "@utils/schema";
import { parseFilter } from "./parse-filter";
import styles from "./index.module.css";

export function Filter({
  value,
  onChange,
  schema,
  filters: toFilters,
  defaultValue,
}: ComponentProps & {
  schema?: FieldSchema;
  filters?: (
    schema?: FieldSchema,
    scope?: ValueSource<Record<string, unknown>>,
    domain?: string,
    fields?: DatabaseField[],
  ) => FilterField[];
  defaultValue?: unknown;
}) {
  const page = usePage();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    parseFilter(value ?? defaultValue),
  );
  const expressionScope = useCallback(
    () => ({
      ...page.runtime.createScope(page.domain, page.query, "edit"),
      $values: page.form.values(),
      $form: page.form,
    }),
    [page],
  );
  const fields = useMemo(() => {
    return toFilters?.(schema, expressionScope, page.domain, page.model.fields) ?? [];
  }, [expressionScope, page.domain, page.model.fields, schema, toFilters]);
  const visibleCount = 4;
  const hasExtraFields = fields.length > visibleCount;

  useEffect(() => {
    setDraft(parseFilter(value ?? defaultValue));
  }, [value, defaultValue]);

  const update = (key: string, next: unknown) => {
    setDraft((current) => ({
      ...current,
      [key]: next === "" || next == null ? undefined : next,
    }));
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
              {field.render(draft[field.name], (next) => update(field.name, next))}
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
