import { ProfileOutlined } from '@ant-design/icons';
import { Button, Tag, Tooltip, Typography } from 'antd';
import type { CmsFieldSchema, ModelRecord, TableColumnProjection } from '../types/record';
import { canUseSharedDisplayComponent } from '../../../shared/form-renderer';
import { getDisplaySummary } from '../../../shared/form-renderer/adapters';

function renderSimpleValue(
  value: unknown,
  options: {
    column?: TableColumnProjection;
    format?: string;
    dataSource?: CmsFieldSchema['dataSource'];
    ellipsis?: boolean;
  } = {},
) {
  const summary = getDisplaySummary({
    value,
    format: options.format,
    dataSource: options.dataSource,
  });

  if (summary.kind === 'status') {
    return <Tag color={summary.color}>{summary.text}</Tag>;
  }

  return (
    <Typography.Text
      style={{ display: 'block', width: '100%' }}
      ellipsis={options.ellipsis ? { tooltip: summary.fullText ?? summary.text } : false}
    >
      {summary.text}
    </Typography.Text>
  );
}

function getInlineDisplayText(value: unknown, format?: string, dataSource?: CmsFieldSchema['dataSource']) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean' || format === 'boolean') {
    return value ? '是' : '否';
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => dataSource?.find((option) => option.value === item)?.label ?? item)
      .filter((item) => item !== null && item !== undefined && item !== '');
    return items.length > 0 ? items.join(', ') : null;
  }

  if (format === 'date') {
    return String(value).slice(0, 10);
  }

  if (format === 'dateTime') {
    return String(value).slice(0, 16).replace('T', ' ');
  }

  return String(dataSource?.find((option) => option.value === value)?.label ?? value);
}

function isComplexColumn(column: TableColumnProjection) {
  return column.type === 'array' || column.type === 'object' || column.type === 'void';
}

function isExpandableColumn(column: TableColumnProjection) {
  if (typeof column.expandable === 'boolean') {
    return column.expandable;
  }

  return isComplexColumn(column);
}

function getObjectSource(
  column: TableColumnProjection,
  value: unknown,
  record: ModelRecord,
) {
  if (column.type === 'void') {
    return record;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getInlineKeys(field: CmsFieldSchema, inlineKeys?: string[]) {
  if (inlineKeys?.length) {
    return inlineKeys;
  }

  const propertyKeys = Object.keys(field.properties ?? {});
  if (propertyKeys.length > 0) {
    return propertyKeys.slice(0, 3);
  }

  return [];
}

function buildInlineTokens(
  field: CmsFieldSchema,
  source: Record<string, unknown>,
  inlineKeys?: string[],
) {
  const keys = getInlineKeys(field, inlineKeys);
  const tokens = keys
    .map((key) => {
      const childField = field.properties?.[key] as CmsFieldSchema | undefined;
      const childValue = source[key];
      if (childValue === null || childValue === undefined || childValue === '') {
        return null;
      }

      return getInlineDisplayText(
        childValue,
        childField?.['x-cms']?.table?.format ?? childField?.['x-cms']?.detail?.format,
        childField?.dataSource,
      );
    })
    .filter((item): item is string => Boolean(item));

  return tokens;
}

function buildObjectSummary(
  column: TableColumnProjection,
  value: unknown,
  record: ModelRecord,
) {
  const source = getObjectSource(column, value, record);
  if (!source) {
    return '—';
  }

  const tokens = buildInlineTokens(column.field, source, column.inline);
  if (tokens.length > 0) {
    return tokens.join(' · ');
  }

  const count = Object.values(source).filter((item) => item !== null && item !== undefined && item !== '').length;
  return count > 0 ? `已配置 ${count} 项` : '—';
}

function buildScalarArraySummary(items: unknown[]) {
  if (items.length === 0) {
    return '—';
  }

  return (
    <>
      {items.slice(0, 2).map((item) => (
        <Tag key={String(item)}>{String(item)}</Tag>
      ))}
      {items.length > 2 ? <Typography.Text type="secondary">+{items.length - 2}</Typography.Text> : null}
    </>
  );
}

function getArrayItemInlineKeys(field: CmsFieldSchema, inlineKeys?: string[]) {
  if (inlineKeys?.length) {
    return inlineKeys;
  }

  const itemProperties =
    field.items && !Array.isArray(field.items) && field.items.type === 'object'
      ? ((field.items.properties ?? {}) as Record<string, CmsFieldSchema>)
      : undefined;

  if (!itemProperties) {
    return [];
  }

  const preferredKeys = ['name', 'title', 'label', 'format', 'owner', 'status'];
  const matchedKeys = preferredKeys.filter((key) => itemProperties[key]);
  if (matchedKeys.length > 0) {
    return matchedKeys.slice(0, 2);
  }

  return Object.keys(itemProperties).slice(0, 2);
}

function buildArrayObjectSummary(field: CmsFieldSchema, items: Record<string, unknown>[], inlineKeys?: string[]) {
  const itemProperties =
    field.items && !Array.isArray(field.items) && field.items.type === 'object'
      ? ({
          ...field.items,
          properties: field.items.properties ?? {},
        } as CmsFieldSchema)
      : undefined;

  if (!itemProperties) {
    return `共 ${items.length} 项`;
  }

  const summaryKeys = getArrayItemInlineKeys(field, inlineKeys);
  const itemSummaries = items
    .slice(0, 2)
    .map((item) => buildInlineTokens(itemProperties, item, summaryKeys).join(' · '))
    .filter(Boolean);

  if (itemSummaries.length === 0) {
    return `共 ${items.length} 项`;
  }

  const suffix = items.length > 2 ? ` +${items.length - 2}` : '';
  return `${itemSummaries.join(' / ')}${suffix}`;
}

function buildArraySummary(column: TableColumnProjection, value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return '—';
  }

  const scalarItems = value.filter(
    (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item),
  );

  if (scalarItems.length === value.length) {
    return buildScalarArraySummary(scalarItems);
  }

  const objectItems = value.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );

  if (objectItems.length === value.length) {
    return buildArrayObjectSummary(column.field, objectItems, column.inline);
  }

  return `共 ${value.length} 项`;
}

export function renderTableCell(
  column: TableColumnProjection,
  value: unknown,
  record: ModelRecord,
  onOpenFieldDetail: (column: TableColumnProjection, record: ModelRecord) => void,
) {
  if (canUseSharedDisplayComponent(column.field)) {
    const summary = getDisplaySummary({
      value,
      format: column.format,
      dataSource: column.dataSource,
    });

    return (
      <div className="table-cell-complex">
        <div className="table-cell-summary">
          {renderSimpleValue(value, {
            column,
            format: column.format,
            dataSource: column.dataSource,
            ellipsis: column.ellipsis,
          })}
        </div>
        {summary.expandable ? (
          <Tooltip title={`点击查看${column.title}全部内容`}>
            <Button
              type="link"
              size="small"
              icon={<ProfileOutlined />}
              aria-label={`查看${column.title}全部内容`}
              onClick={() => onOpenFieldDetail(column, record)}
            />
          </Tooltip>
        ) : null}
      </div>
    );
  }

  const summary =
    column.type === 'array'
      ? buildArraySummary(column, value)
      : buildObjectSummary(column, value, record);

  return (
    <div className="table-cell-complex">
      <div className="table-cell-summary">{typeof summary === 'string' ? <Typography.Text ellipsis={column.ellipsis ? { tooltip: summary } : false}>{summary}</Typography.Text> : summary}</div>
      {isExpandableColumn(column) ? (
        <Tooltip title={`点击查看${column.title}详情`}>
          <Button
            type="link"
            size="small"
            icon={<ProfileOutlined />}
            aria-label={`查看${column.title}详情`}
            onClick={() => onOpenFieldDetail(column, record)}
          />
        </Tooltip>
      ) : null}
    </div>
  );
}
