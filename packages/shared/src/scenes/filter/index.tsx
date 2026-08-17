import { useCallback, useMemo, useState } from "react";
import type { IFormSchema } from "@alien-form/core";
import { FormProvider, SchemaField, useCreateForm } from "@alien-form/react";
import { App } from "antd";
import * as adapters from "../../adapters";
import { buildRenderableScenes } from "../../build-renderable-scenes";
import { createFormConfig } from "../../create-form-config";
import type { FilterActions, FilterProjection, SchemaHandlers, SchemaRecord } from "../../types";
import { FormActionContext, FormActions, type FormActionContextValue } from "../../ui/form-actions";
import { FilterItem } from "./item";

const filterComponents = buildRenderableScenes(adapters, "filter");
const filterDecorators = { FilterItem } as const;
const EMPTY_KEYS: string[] = [];

export function applyFilterVisibility(
  schema: IFormSchema,
  expanded: boolean,
  defaultVisibleKeys: string[],
): IFormSchema {
  const visibleKeySet = new Set(defaultVisibleKeys);
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, field]) => [
      key,
      {
        ...field,
        display: expanded || visibleKeySet.has(key) ? ("visible" as const) : ("none" as const),
      },
    ]),
  );

  return { ...schema, properties };
}

function FilterForm({
  schema,
  initialValues,
  handlers,
  actionContext,
}: {
  schema: IFormSchema;
  initialValues: SchemaRecord;
  handlers?: SchemaHandlers;
  actionContext: FormActionContextValue;
}) {
  const { message: messageApi } = App.useApp();
  const form = useCreateForm(createFormConfig({ schema, initialValues, handlers, messageApi }), [
    schema,
    initialValues,
    handlers,
    messageApi,
  ]);

  return (
    <FormActionContext.Provider value={actionContext}>
      <div className="schema-filter-panel">
        <div className="schema-filter-form">
          <FormProvider
            form={form}
            components={filterComponents as never}
            decorators={filterDecorators as never}
          >
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

export interface SchemaFilterProps {
  projection: FilterProjection;
  initialValues?: SchemaRecord;
  handlers?: SchemaHandlers;
  actions: FilterActions;
  loading?: boolean;
}

export function SchemaFilter({
  projection,
  initialValues = {},
  handlers,
  actions,
  loading,
}: SchemaFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const defaultVisibleKeys = projection.defaultVisibleKeys ?? EMPTY_KEYS;
  const schema = useMemo(
    () => applyFilterVisibility(projection.schema, expanded, defaultVisibleKeys),
    [projection.schema, expanded, defaultVisibleKeys],
  );
  const showExpandButton =
    Object.keys(projection.schema.properties ?? {}).length > defaultVisibleKeys.length;

  const handleReset = useCallback(() => {
    (actions.onReset ?? actions.onSearch)({});
  }, [actions.onReset, actions.onSearch]);
  const handleToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);
  const actionContext = useMemo<FormActionContextValue>(
    () => ({
      kind: "filter",
      loading,
      submitText: actions.searchText ?? "查询",
      showReset: true,
      showExpandButton,
      expanded,
      onSubmit: actions.onSearch,
      onReset: handleReset,
      onToggleExpanded: handleToggleExpanded,
    }),
    [
      actions.onSearch,
      actions.searchText,
      expanded,
      handleReset,
      handleToggleExpanded,
      loading,
      showExpandButton,
    ],
  );

  return (
    <FilterForm
      schema={schema}
      initialValues={initialValues}
      handlers={handlers}
      actionContext={actionContext}
    />
  );
}
