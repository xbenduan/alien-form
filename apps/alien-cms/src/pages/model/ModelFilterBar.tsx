import type { IFieldSchema, IFormSchema } from '@alien-form/react';
import { FormProvider, SchemaField, useCreateForm, useForm, useFormValues } from '@alien-form/react';
import { DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as adapters from '../../adapters';
import type { FilterFieldProjection } from '../../types/model';

interface ModelFilterBarProps {
  fields: FilterFieldProjection[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

// ---- Filter Actions Context ----
// Dynamic values that change after form creation (loading, callbacks)
// are passed via context instead of schema props to avoid stale signals.

interface FilterActionsContextValue {
  loading?: boolean;
  showExpandButton?: boolean;
  expanded?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
  onReset: () => void;
  onToggleExpanded: () => void;
}

const FilterActionsContext = createContext<FilterActionsContextValue | null>(null);

/**
 * Void field component that renders query/reset/expand buttons.
 * Reads dynamic state from FilterActionsContext, uses useForm() for submit/reset.
 */
function FilterActions() {
  const ctx = useContext(FilterActionsContext);
  const form = useForm();

  if (!ctx) return null;

  const { loading, showExpandButton, expanded, onSearch, onReset, onToggleExpanded } = ctx;

  return (
    <Space size={8}>
      <Button
        type="primary"
        icon={<SearchOutlined />}
        loading={loading}
        onClick={() => {
          form.submit((values) => {
            onSearch(values);
          });
        }}
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
  );
}

// ---- Components & Decorators ----

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
  FilterActions,
};

const filterDecorators = {
  FilterItem: adapters.FilterItem,
};

// ---- Schema builders ----

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
  const fieldEntries = fields.map((field) => [
    field.key,
    buildFilterField(field, expanded || field.defaultVisible),
  ]);

  return {
    type: 'object',
    properties: {
      ...Object.fromEntries(fieldEntries),
      __actions: {
        type: 'void',
        component: 'FilterActions',
        decorator: 'FilterItem',
        order: 9999,
      },
    },
  };
}

// ---- Internal components ----

function FilterValuesSync({ onChange }: { onChange: (values: Record<string, unknown>) => void }) {
  const currentValues = useFormValues();

  useEffect(() => {
    onChange(currentValues);
  }, [currentValues, onChange]);

  return null;
}

function FilterSchemaRenderer({
  schema,
  initialValues,
  onDraftChange,
}: {
  schema: IFormSchema;
  initialValues: Record<string, unknown>;
  onDraftChange: (values: Record<string, unknown>) => void;
}) {
  const form = useCreateForm({ schema, initialValues });

  return (
    <div className="model-filter-panel">
      <FormProvider
        form={form}
        components={filterComponents as Record<string, React.ComponentType<any>>}
        decorators={filterDecorators as Record<string, React.ComponentType<any>>}
      >
        <div className="model-filter-form">
          <SchemaField />
          <FilterValuesSync onChange={onDraftChange} />
        </div>
      </FormProvider>
    </div>
  );
}

// ---- Exported component ----

export function ModelFilterBar({ fields, values, loading, onSearch }: ModelFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>(values);
  const defaultFields = useMemo(() => fields.filter((field) => field.defaultVisible), [fields]);
  const showExpandButton = fields.length > defaultFields.length;
  const filterSchema = useMemo(() => buildFilterSchema(fields, expanded), [fields, expanded]);

  // Stable refs for callbacks
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const handleSearch = useCallback((vals: Record<string, unknown>) => {
    onSearchRef.current(vals);
  }, []);

  const handleReset = useCallback(() => {
    setDraftValues({});
    onSearchRef.current({});
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  // Context value updates on every render with latest loading state
  const actionsCtx = useMemo<FilterActionsContextValue>(() => ({
    loading,
    showExpandButton,
    expanded,
    onSearch: handleSearch,
    onReset: handleReset,
    onToggleExpanded: handleToggleExpanded,
  }), [loading, showExpandButton, expanded, handleSearch, handleReset, handleToggleExpanded]);

  useEffect(() => {
    setDraftValues(values);
  }, [values]);

  return (
    <FilterActionsContext.Provider value={actionsCtx}>
      <FilterSchemaRenderer
        key={expanded ? 'expanded' : 'collapsed'}
        schema={filterSchema}
        initialValues={draftValues}
        onDraftChange={setDraftValues}
      />
    </FilterActionsContext.Provider>
  );
}
