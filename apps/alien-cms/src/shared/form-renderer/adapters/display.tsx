import type { DataSourceItem } from '@alien-form/react';
import { Image, Rate, Tag, Typography } from 'antd';

const EMPTY_TEXT = '—';

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

export interface DisplaySummary {
  text: string;
  kind: 'plain' | 'status' | 'image' | 'link' | 'rate';
  color?: string;
  fullText?: string;
  expandable?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  review: 'processing',
  pending: 'processing',
  published: 'success',
  active: 'success',
  archived: 'warning',
  disabled: 'warning',
  error: 'error',
  failed: 'error',
  deleted: 'error',
};

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || value === '';
}

function getChoiceLabel(value: unknown, dataSource?: DataSourceItem[]) {
  return dataSource?.find((item) => item.value === value)?.label;
}

function inferStatusColor(value: unknown) {
  return STATUS_COLORS[String(value).toLowerCase()] ?? 'default';
}

function formatDateText(value: unknown, withTime: boolean) {
  const text = String(value);
  return withTime ? text.slice(0, 16).replace('T', ' ') : text.slice(0, 10);
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
}: Omit<DisplayValueProps, 'ellipsis'>): DisplaySummary {
  if (isEmptyValue(value)) {
    return {
      text: EMPTY_TEXT,
      kind: 'plain',
      fullText: EMPTY_TEXT,
      expandable: false,
    };
  }

  if (Array.isArray(value)) {
    const items = normalizeArrayItems(value, dataSource);
    const text = items.length > 0 ? items.join(', ') : EMPTY_TEXT;
    return {
      text,
      kind: 'plain',
      fullText: text,
      expandable: items.length > 1 || text.length > 24,
    };
  }

  if (format === 'status') {
    const text = String(getChoiceLabel(value, dataSource) ?? value);
    return {
      text,
      kind: 'status',
      color: inferStatusColor(value),
      fullText: text,
      expandable: false,
    };
  }

  if (format === 'image' && typeof value === 'string') {
    return {
      text: value,
      kind: 'image',
      fullText: value,
      expandable: true,
    };
  }

  if (format === 'link' && typeof value === 'string') {
    return {
      text: value,
      kind: 'link',
      fullText: value,
      expandable: value.length > 24,
    };
  }

  if (format === 'date') {
    const text = formatDateText(value, false);
    return {
      text,
      kind: 'plain',
      fullText: text,
      expandable: false,
    };
  }

  if (format === 'dateTime') {
    const text = formatDateText(value, true);
    return {
      text,
      kind: 'plain',
      fullText: text,
      expandable: false,
    };
  }

  if (typeof value === 'boolean' || format === 'boolean') {
    const text = Boolean(value) ? '是' : '否';
    return {
      text,
      kind: 'plain',
      fullText: text,
      expandable: false,
    };
  }

  const text = String(getChoiceLabel(value, dataSource) ?? value);
  return {
    text,
    kind: 'plain',
    fullText: text,
    expandable: text.length > 24,
  };
}

function renderTagList(items: string[]) {
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

function renderText(text: string, ellipsis?: boolean) {
  if (!ellipsis && text.length > 120) {
    return (
      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography.Paragraph>
    );
  }

  if (ellipsis) {
    return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
  }

  return <>{text}</>;
}

export function DisplayText({
  value,
  dataSource,
  format,
  ellipsis,
}: DisplayValueProps) {
  const summary = getDisplaySummary({ value, dataSource, format });

  if (summary.kind === 'image' && typeof value === 'string') {
    return <Image src={value} alt={value} style={{ maxWidth: 160 }} />;
  }

  if (summary.kind === 'link' && typeof value === 'string') {
    return (
      <Typography.Link href={value} target="_blank" rel="noreferrer">
        {value}
      </Typography.Link>
    );
  }

  if (summary.kind === 'status') {
    return <Tag color={summary.color}>{summary.text}</Tag>;
  }

  if (Array.isArray(value)) {
    return renderTagList(normalizeArrayItems(value, dataSource));
  }

  return renderText(summary.text, ellipsis);
}

export function DisplayChoice(props: DisplayValueProps) {
  return <DisplayText {...props} />;
}

export function DisplayBoolean({
  value,
  ellipsis,
}: DisplayValueProps) {
  return renderText(getDisplaySummary({ value, format: 'boolean' }).text, ellipsis);
}

export function DisplayDate(props: DisplayValueProps) {
  return <DisplayText {...props} format={props.format ?? 'date'} />;
}

export function DisplayRate({
  value,
}: DisplayValueProps) {
  if (isEmptyValue(value)) {
    return <>{EMPTY_TEXT}</>;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return <>{String(value)}</>;
  }

  return <Rate disabled value={numericValue} />;
}

export function DisplayTags({
  value,
}: DisplayValueProps) {
  if (!Array.isArray(value)) {
    return <>{EMPTY_TEXT}</>;
  }

  return renderTagList(normalizeArrayItems(value));
}
