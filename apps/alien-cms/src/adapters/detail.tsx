import type { DataSourceItem } from '@alien-form/react';
import { Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

function getLabel(value: unknown, dataSource?: DataSourceItem[]) {
  return dataSource?.find((item) => item.value === value)?.label;
}

function renderScalar(value: unknown, dataSource?: DataSourceItem[]) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.map((item) => <Tag key={String(item)}>{String(item)}</Tag>);
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return getLabel(value, dataSource) ?? String(value);
}

interface DetailTextProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
}

export function DetailText({ value, dataSource }: DetailTextProps) {
  if (typeof value === 'string' && value.length > 120) {
    return <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{value}</Typography.Paragraph>;
  }

  return <>{renderScalar(value, dataSource)}</>;
}

export function DetailBoolean({ value }: { value?: unknown }) {
  return <>{value ? '是' : '否'}</>;
}

export function DetailDate({ value }: { value?: unknown }) {
  return <>{value ? dayjs(String(value)).format('YYYY-MM-DD') : '—'}</>;
}

export function DetailDateTime({ value }: { value?: unknown }) {
  return <>{value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '—'}</>;
}

export function DetailStatus({ value, dataSource }: DetailTextProps) {
  const label = getLabel(value, dataSource) ?? (value ? String(value) : '—');
  const colorMap: Record<string, string> = {
    draft: 'default',
    review: 'processing',
    published: 'success',
    archived: 'warning',
  };
  return <Tag color={colorMap[String(value)]}>{label}</Tag>;
}

export function DetailArrayText({ value }: { value?: unknown }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <>—</>;
  }

  const scalarItems = value.filter(
    (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item),
  );

  if (scalarItems.length === value.length) {
    return <>{scalarItems.map((item) => <Tag key={String(item)}>{String(item)}</Tag>)}</>;
  }

  return <Typography.Text type="secondary">共 {value.length} 项</Typography.Text>;
}

export function DetailSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title ? (
        <div style={{ marginBottom: 12 }}>
          <Typography.Title level={5} style={{ marginBottom: 4 }}>
            {title}
          </Typography.Title>
          {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
