import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
} from "@alien-form/react";
import {
  FormActionContext,
  FormActions,
  type FormActionContextValue,
} from "../ui";
import type { CmsModelSchema } from "../../domains/record/types/record";
import { createRecordFormConfig } from "../utils/create-record-form-config";
import { buildRenderableScenes } from "../utils/build-renderable-scenes";
import FilterItem from "./form-item";
import * as adapters from "../adapters";

const filterComponents = buildRenderableScenes(adapters, "filter");

const filterDecorators = {
  FilterItem,
} as const;

interface SchemaFilterBodyProps {
  schema: CmsModelSchema;
  initialValues: Record<string, unknown>;
  loading?: boolean;
  defaultVisibleKeys: string[];
  onSearch: (values: Record<string, unknown>) => void;
}

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
        display: expanded || visibleKeySet.has(key) ? ("visible" as const) : ("none" as const),
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
  const form = useCreateForm(
    createRecordFormConfig({
      schema,
      initialValues,
    }),
  );

  return (
    <FormActionContext.Provider value={actionsCtx}>
      <div className="model-filter-panel">
        <div className="model-filter-form">
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

export function SchemaFilterBody({
  schema,
  initialValues,
  loading,
  defaultVisibleKeys,
  onSearch,
}: SchemaFilterBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleSchema = useMemo(
    () => applyFilterVisibility(schema, expanded, defaultVisibleKeys),
    [schema, expanded, defaultVisibleKeys],
  );
  const renderKey = useMemo(
    () => {
      const schemaSignature = Object.keys(schema.properties ?? {}).join("|");
      return `${expanded ? "expanded" : "collapsed"}:${schemaSignature}:${JSON.stringify(initialValues)}`;
    },
    [expanded, initialValues, schema],
  );
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const showExpandButton =
    Object.keys(schema.properties ?? {}).length > defaultVisibleKeys.length;

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
      kind: "filter",
      loading,
      submitText: "查询",
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
      initialValues={initialValues}
      actionsCtx={actionsCtx}
    />
  );
}

export default SchemaFilterBody;
