import {
  FormProvider,
  SchemaField,
  useCreateForm,
} from '@alien-form/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as adapters from '../../../shared/form-renderer/adapters';
import {
  FormActionContext,
  FormActions,
  type FormActionContextValue,
} from '../../../shared/form-renderer';
import type { CmsModelSchema } from '../types/record';
import { createRecordFormConfig } from './create-record-form-config';

interface RecordFilterBarProps {
  schema: CmsModelSchema;
  defaultVisibleKeys: string[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

const filterComponents = {
  Input: adapters.Input,
  Textarea: adapters.Input,
  NumberInput: adapters.NumberInput,
  Select: adapters.Select,
  Switch: adapters.Select,
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

function applyFilterVisibility(
  schema: CmsModelSchema,
  expanded: boolean,
  defaultVisibleKeys: string[],
): CmsModelSchema {
  const visibleKeySet = new Set(defaultVisibleKeys);
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, field]) => [
      key,
      {
        ...field,
        display: expanded || visibleKeySet.has(key) ? ('visible' as const) : ('none' as const),
      },
    ]),
  );

  return {
    ...schema,
    properties,
  };
}

function FilterFormScene({
  schema,
  initialValues,
  actionsCtx,
}: {
  schema: CmsModelSchema;
  initialValues: Record<string, unknown>;
  actionsCtx: FormActionContextValue;
}) {
  const form = useCreateForm(createRecordFormConfig({
    schema,
    initialValues,
  }));

  return (
    <FormActionContext.Provider value={actionsCtx}>
      <div className="model-filter-panel">
        <div className="model-filter-form">
          <FormProvider form={form} components={filterComponents as never} decorators={filterDecorators as never}>
            <SchemaField />
          </FormProvider>
          <div className="filter-form-item">
            <FormActions form={form} />
          </div>
        </div>
      </div>
    </FormActionContext.Provider>
  );
}

export function RecordFilterBar({
  schema,
  defaultVisibleKeys,
  values,
  loading,
  onSearch,
}: RecordFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleSchema = useMemo(
    () => applyFilterVisibility(schema, expanded, defaultVisibleKeys),
    [schema, expanded, defaultVisibleKeys],
  );
  const renderKey = useMemo(
    () => `${expanded ? 'expanded' : 'collapsed'}:${JSON.stringify(values)}`,
    [expanded, values],
  );
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const showExpandButton = Object.keys(schema.properties ?? {}).length > defaultVisibleKeys.length;

  const handleSearch = useCallback((nextValues: Record<string, unknown>) => {
    onSearchRef.current(nextValues);
  }, []);

  const handleReset = useCallback(() => {
    onSearchRef.current({});
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  const actionsCtx = useMemo<FormActionContextValue>(
    () => ({
      kind: 'filter',
      loading,
      submitText: '查询',
      showReset: true,
      showExpandButton,
      expanded,
      onSubmit: handleSearch,
      onReset: handleReset,
      onToggleExpanded: handleToggleExpanded,
    }),
    [loading, showExpandButton, expanded, handleSearch, handleReset, handleToggleExpanded],
  );

  return (
    <FilterFormScene
      key={renderKey}
      schema={visibleSchema}
      initialValues={values}
      actionsCtx={actionsCtx}
    />
  );
}
