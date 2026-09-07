import { Button, Card, Space } from "antd";
import { useCallback, useMemo, useState } from "react";
import { usePage, type ComponentProps, type ValueSource } from "@alien-form/react";
import type { DatabaseField, FieldSchema } from "@alien-form/engine";
import type { FilterField } from "../utils/schema";
import styles from "./index.module.css";

interface ReferenceValue {
  value: unknown;
}

function isReferenceValue(value: unknown): value is ReferenceValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value;
}

function scalar(value: unknown): string | number | boolean | undefined {
  const raw = isReferenceValue(value) ? value.value : value;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
  return undefined;
}

function literal(value: string | number | boolean): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

/** 筛选表单的临时值 → records.list 的唯一筛选协议。 */
function toFilter(draft: Record<string, unknown>, fields: FilterField[]): string | undefined {
  const expressions = fields.flatMap(({ name, type }) => {
    const value = draft[name];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return [];
    const values = (Array.isArray(value) ? value : [value])
      .map(scalar)
      .filter((item): item is string | number | boolean => item !== undefined);
    if (values.length === 0) return [];
    const operator = type === "text" ? "~" : "=";
    const comparisons = values.map((item) => `${name} ${operator} ${literal(item)}`);
    return comparisons.length === 1 ? comparisons : [`(${comparisons.join(" || ")})`];
  });
  return expressions.length > 0 ? expressions.join(" && ") : undefined;
}

export function Filter({
  onChange,
  schema,
  filterFields: buildFilterFields,
}: ComponentProps & {
  schema?: FieldSchema;
  filterFields?: (
    schema?: FieldSchema,
    scope?: ValueSource<Record<string, unknown>>,
    domain?: string,
    fields?: DatabaseField[],
  ) => FilterField[];
}) {
  const page = usePage();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const expressionScope = useCallback(
    () => ({
      ...page.runtime.createScope(page.domain, page.query, "edit"),
      $values: page.form.values(),
      $form: page.form,
    }),
    [page],
  );
  const fields = useMemo(() => {
    return buildFilterFields?.(schema, expressionScope, page.domain, page.model.fields) ?? [];
  }, [buildFilterFields, expressionScope, page.domain, page.model.fields, schema]);
  const visibleCount = 4;
  const hasExtraFields = fields.length > visibleCount;

  const update = (key: string, next: unknown) => {
    setDraft((current) => ({
      ...current,
      [key]: next === "" || next == null ? undefined : next,
    }));
  };
  const reset = () => {
    setDraft({});
    onChange?.("");
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
            <Button type="primary" onClick={() => onChange?.(toFilter(draft, fields) ?? "")}>
              查询
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}
