import { Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import type { DataSourceItem } from '@alien-form/react';
import type { ValueFormat } from '../../types/model';

const statusColors: Record<string, string> = {
  draft: 'default',
  review: 'processing',
  published: 'success',
  archived: 'warning',
};

function getLabel(value: unknown, dataSource?: DataSourceItem[]) {
  return dataSource?.find((item) => item.value === value)?.label;
}

export function formatValueText(
  value: unknown,
  format?: ValueFormat,
  dataSource?: DataSourceItem[],
) : string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(' / ') : '—';
  }

  if (format === 'boolean' || typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (format === 'date') {
    return dayjs(String(value)).format('YYYY-MM-DD');
  }

  if (format === 'dateTime') {
    return dayjs(String(value)).format('YYYY-MM-DD HH:mm');
  }

  return getLabel(value, dataSource) ?? String(value);
}

function formatScalar(
  value: unknown,
  format?: ValueFormat,
  dataSource?: DataSourceItem[],
) {
  if (format === 'status' && value !== null && value !== undefined && value !== '') {
    const label = getLabel(value, dataSource) ?? String(value);
    return <Tag color={statusColors[String(value)]}>{label}</Tag>;
  }

  return formatValueText(value, format, dataSource);
}

export function renderTableValue(
  value: unknown,
  options: {
    format?: ValueFormat;
    dataSource?: DataSourceItem[];
    ellipsis?: boolean;
  } = {},
): ReactNode {
  const rendered = formatScalar(value, options.format, options.dataSource);

  if (options.ellipsis && typeof rendered === 'string') {
    return (
      <Typography.Text ellipsis={{ tooltip: rendered }}>{rendered}</Typography.Text>
    );
  }

  return rendered;
}

export function renderDetailValue(
  value: unknown,
  options: {
    format?: ValueFormat;
    dataSource?: DataSourceItem[];
  } = {},
): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }

    return value.map((item) => <Tag key={String(item)}>{String(item)}</Tag>);
  }

  if (typeof value === 'string' && value.length > 120) {
    return <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{value}</Typography.Paragraph>;
  }

  return formatScalar(value, options.format, options.dataSource);
}
