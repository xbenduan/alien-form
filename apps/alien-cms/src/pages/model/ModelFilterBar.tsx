import type { IFieldSchema, IFormSchema } from '@alien-form/react';
import { FormProvider, SchemaField, useCreateForm, useFormValues } from '@alien-form/react';
import { DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as adapters from '../../adapters';
import type { FilterFieldProjection } from '../../types/model';

interface ModelFilterBarProps {
  fields: FilterFieldProjection[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

const filterComponents = {
  Input: adapters.Input,
  Textarea: adapters.Textarea,
  NumberInput: adapters.NumberInput,
  Select: adapters.Select,
  Switch: adapters.Switch,
  DateInput: adapters.DateInput,
  Radio: adapters.Radio,
  CheckboxGroup: adapters.CheckboxGroup,
  Rate: adapters.Rate,
  ArrayCards: adapters.ArrayCards,
  SectionCard: adapters.SectionCard,
  TagsInput: adapters.TagsInput,
  SkuTable: adapters.SkuTable,
};

const filterDecorators = {
  FilterItem: adapters.FilterItem,
};

function buildFilterField(field: FilterFieldProjection, visible: boolean): IFieldSchema {
  const isBooleanField = field.component === 'Switch' || field.type === 'boolean';
  return {
    type: field.type,
    title: field.title,
    component: isBooleanField ? 'Select' : field.component,
    decorator: 'FilterItem',
    order: field.order,
    display: visible ? 'visible' : 'none',
    props: {
      ...(field.props ?? {}),
      placeholder: String(
        field.props?.placeholder ??
          (isBooleanField ? `请选择${field.title}` : field.component === 'Select' ? `请选择${field.title}` : `请输入${field.title}`),
      ),
    },
    dataSource: isBooleanField
      ? [
          { label: '是', value: true },
          { label: '否', value: false },
        ]
      : field.dataSource,
  };
}

function buildFilterSchema(fields: FilterFieldProjection[], expanded: boolean): IFormSchema {
  return {
    type: 'object',
    properties: Object.fromEntries(
      fields.map((field) => [
        field.key,
        buildFilterField(field, expanded || field.defaultVisible),
      ]),
    ),
  };
}

function FilterValuesSync({
  onChange,
}: {
  onChange: (values: Record<string, unknown>) => void;
}) {
  const currentValues = useFormValues();

  useEffect(() => {
    onChange(currentValues);
  }, [currentValues, onChange]);

  return null;
}

function FilterSchemaRenderer({
  schema,
  initialValues,
  loading,
  showExpandButton,
  expanded,
  onDraftChange,
  onSearch,
  onReset,
  onToggleExpanded,
}: {
  schema: IFormSchema;
  initialValues: Record<string, unknown>;
  loading?: boolean;
  showExpandButton: boolean;
  expanded: boolean;
  onDraftChange: (values: Record<string, unknown>) => void;
  onSearch: (values: Record<string, unknown>) => void;
  onReset: () => void;
  onToggleExpanded: () => void;
}) {
  const form = useCreateForm({ schema, initialValues });

  return (
    <div className="model-filter-panel">
      <FormProvider
        form={form}
        components={filterComponents as Record<string, any>}
        decorators={filterDecorators as Record<string, any>}
      >
        <div className="model-filter-row">
          <div className="model-filter-fields">
            <SchemaField />
            <FilterValuesSync onChange={onDraftChange} />
          </div>
          <div className="model-filter-actions">
            <Space size={8}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={loading}
                onClick={() => form.submit((nextValues) => onSearch(nextValues))}
              >
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.setInitialValues({});
                  form.reset();
                  onReset();
                }}
              >
                重置
              </Button>
              {showExpandButton ? (
                <Button
                  type="link"
                  icon={expanded ? <UpOutlined /> : <DownOutlined />}
                  onClick={onToggleExpanded}
                  style={{ paddingInline: 4 }}
                >
                  {expanded ? '收起' : '展开'}
                </Button>
              ) : null}
            </Space>
          </div>
        </div>
      </FormProvider>
    </div>
  );
}

export function ModelFilterBar({ fields, values, loading, onSearch }: ModelFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>(values);
  const defaultFields = useMemo(() => fields.filter((field) => field.defaultVisible), [fields]);
  const showExpandButton = fields.length > defaultFields.length;
  const filterSchema = useMemo(() => buildFilterSchema(fields, expanded), [expanded, fields]);

  useEffect(() => {
    setDraftValues(values);
  }, [values]);

  return (
    <FilterSchemaRenderer
      key={expanded ? 'expanded' : 'collapsed'}
      schema={filterSchema}
      initialValues={draftValues}
      loading={loading}
      showExpandButton={showExpandButton}
      expanded={expanded}
      onDraftChange={setDraftValues}
      onSearch={onSearch}
      onReset={() => {
        setDraftValues({});
        onSearch({});
      }}
      onToggleExpanded={() => setExpanded((current) => !current)}
    />
  );
}
