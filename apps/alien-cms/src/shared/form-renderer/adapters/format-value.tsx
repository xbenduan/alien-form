import { formatValue } from '@alien-form/cms';
import type { DataSourceItem, IFieldSchema } from '@alien-form/react';
import { Image, Tag, Typography } from 'antd';

function toDisplayText(value: unknown, fallback: string) {
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return fallback;
}

interface FormatValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
  placeholder?: string;
  type?: IFieldSchema['type'];
}

export function FormatValue({
  value,
  dataSource,
  format,
  ellipsis,
}: FormatValueProps) {
  const result = formatValue(value, format as never, dataSource);
  const text = toDisplayText(value, result.text);

  if (result.type === 'status') {
    return <Tag color={result.color}>{text}</Tag>;
  }

  if (result.type === 'tags') {
    const items = result.items ?? [];
    if (items.length === 0) {
      return <>—</>;
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

  if (result.type === 'image' && typeof result.raw === 'string') {
    return <Image src={result.raw} alt={text} style={{ maxWidth: 160 }} />;
  }

  if (result.type === 'link' && typeof result.raw === 'string') {
    return (
      <Typography.Link href={result.raw} target="_blank" rel="noreferrer">
        {text}
      </Typography.Link>
    );
  }

  if (typeof text === 'string' && text.length > 120) {
    return (
      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography.Paragraph>
    );
  }

  if (ellipsis && typeof text === 'string') {
    return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
  }

  return <>{text}</>;
}
