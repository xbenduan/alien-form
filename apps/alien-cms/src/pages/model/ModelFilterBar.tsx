import { DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Col, DatePicker, Input, InputNumber, Row, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import type { FilterFieldProjection } from '../../types/model';

interface ModelFilterBarProps {
  fields: FilterFieldProjection[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

function renderFilterControl(
  field: FilterFieldProjection,
  value: unknown,
  onChange: (nextValue: unknown) => void,
) {
  if (field.component === 'Select') {
    return (
      <Select
        allowClear
        placeholder={String(field.props?.placeholder ?? `请选择${field.title}`)}
        options={field.dataSource?.map((item) => ({ label: item.label, value: item.value }))}
        value={value as string | undefined}
        onChange={onChange}
      />
    );
  }

  if (field.component === 'DateInput') {
    return (
      <DatePicker
        className="full-width-control"
        value={value ? dayjs(String(value)) : null}
        onChange={(_, dateString) => onChange(dateString || undefined)}
      />
    );
  }

  if (field.component === 'NumberInput') {
    return (
      <InputNumber
        className="full-width-control"
        placeholder={String(field.props?.placeholder ?? `请输入${field.title}`)}
        value={typeof value === 'number' ? value : undefined}
        onChange={onChange}
      />
    );
  }

  if (field.component === 'Switch' || field.type === 'boolean') {
    return (
      <Select
        allowClear
        placeholder={`请选择${field.title}`}
        options={[
          { label: '是', value: true },
          { label: '否', value: false },
        ]}
        value={typeof value === 'boolean' ? value : undefined}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      allowClear
      placeholder={String(field.props?.placeholder ?? `请输入${field.title}`)}
      value={typeof value === 'string' ? value : undefined}
      onChange={(event) => onChange(event.target.value || undefined)}
    />
  );
}

export function ModelFilterBar({ fields, values, loading, onSearch }: ModelFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const defaultFields = useMemo(
    () => fields.filter((field) => field.defaultVisible),
    [fields],
  );
  const extraFields = useMemo(
    () => fields.filter((field) => !field.defaultVisible),
    [fields],
  );
  const visibleFields = expanded ? [...defaultFields, ...extraFields] : defaultFields;
  const fieldsBeforeActions = visibleFields.slice(0, defaultFields.length);
  const fieldsAfterActions = visibleFields.slice(defaultFields.length);
  const showExpandButton = fields.length > defaultFields.length;

  return (
    <div className="model-filter-panel">
      <div className="model-filter-form">
        <Row gutter={[16, 16]}>
          {fieldsBeforeActions.map((field) => (
            <Col key={field.key} xs={24} md={12} xl={8}>
              <div className="filter-form-item">
                {renderFilterControl(field, values[field.key], (nextValue) =>
                  onSearch({ ...values, [field.key]: nextValue }),
                )}
              </div>
            </Col>
          ))}
          {fieldsAfterActions.map((field) => (
            <Col key={field.key} xs={24} md={12} xl={8}>
              <div className="filter-form-item">
                {renderFilterControl(field, values[field.key], (nextValue) =>
                  onSearch({ ...values, [field.key]: nextValue }),
                )}
              </div>
            </Col>
          ))}
        </Row>
      </div>
      <div className="filter-actions-row">
        <Space wrap className="filter-actions-cell">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              onClick={() => onSearch({ ...values })}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => onSearch({})}>
              重置
            </Button>
            {showExpandButton ? (
              <Button
                type="link"
                icon={expanded ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? '收起' : '展开'}
              </Button>
            ) : null}
        </Space>
      </div>
    </div>
  );
}
