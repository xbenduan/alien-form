import type { IFieldSchema, IFormSchema } from "@alien-form/react";
import { useFormValues } from "@alien-form/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as adapters from "../../../shared/form-renderer/adapters";
import {
  FormActionContext,
  FormActions,
  SchemaFormScene,
  type FormActionContextValue,
} from "../../../shared/form-renderer";
import type { FilterFieldProjection } from "../types/record";

interface RecordFilterBarProps {
  fields: FilterFieldProjection[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

// ---- Components & Decorators ----

const filterComponents = {
  Input: adapters.Input,
  Textarea: adapters.Input,
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
  FormActions,
};

const filterDecorators = {
  FilterItem: adapters.FilterItem,
};

// ---- Schema builders ----

function isEmptyFilterValue(value: unknown) {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown) {
  const [currentKey, ...restKeys] = path;
  if (!currentKey) {
    return;
  }

  if (restKeys.length === 0) {
    target[currentKey] = value;
    return;
  }

  const currentValue = target[currentKey];
  const nextTarget =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? (currentValue as Record<string, unknown>)
      : {};
  target[currentKey] = nextTarget;
  setNestedValue(nextTarget, restKeys, value);
}

function nestFilterValues(values: Record<string, unknown>) {
  return Object.entries(values).reduce<Record<string, unknown>>((result, [key, value]) => {
    if (isEmptyFilterValue(value)) {
      return result;
    }

    setNestedValue(result, key.split("."), value);
    return result;
  }, {});
}

function flattenFilterValues(
  values: Record<string, unknown>,
  parentKeys: string[] = [],
): Record<string, unknown> {
  return Object.entries(values).reduce<Record<string, unknown>>((result, [key, value]) => {
    const nextKeys = [...parentKeys, key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {
        ...result,
        ...flattenFilterValues(value as Record<string, unknown>, nextKeys),
      };
    }

    result[nextKeys.join(".")] = value;
    return result;
  }, {});
}

function buildFilterField(field: FilterFieldProjection, visible: boolean): IFieldSchema {
  const isBooleanField = field.component === "Switch" || field.type === "boolean";
  return {
    type: field.type,
    title: field.title,
    component: isBooleanField ? "Select" : field.component,
    decorator: "FilterItem",
    order: field.order,
    display: visible ? "visible" : "none",
    props: {
      ...(field.props ?? {}),
      placeholder: String(
        field.props?.placeholder ??
          (isBooleanField
            ? `请选择${field.title}`
            : field.component === "Select"
              ? `请选择${field.title}`
              : `请输入${field.title}`),
      ),
    },
    dataSource: isBooleanField
      ? [
          { label: "是", value: true },
          { label: "否", value: false },
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
    type: "object",
    properties: {
      ...Object.fromEntries(fieldEntries),
      __filter_actions: {
        type: "void",
        component: "FormActions",
        decorator: "FilterItem",
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
  loading,
  onDraftChange,
}: {
  schema: IFormSchema;
  initialValues: Record<string, unknown>;
  loading?: boolean;
  onDraftChange: (values: Record<string, unknown>) => void;
}) {
  return (
    <SchemaFormScene
      schema={schema}
      initialValues={initialValues}
      components={filterComponents as never}
      decorators={filterDecorators as never}
      loading={loading}
      className="model-filter-panel"
      contentClassName="model-filter-form"
    >
      <FilterValuesSync onChange={onDraftChange} />
    </SchemaFormScene>
  );
}

// ---- Exported component ----

export function RecordFilterBar({ fields, values, loading, onSearch }: RecordFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>(() => flattenFilterValues(values));
  const defaultFields = useMemo(() => fields.filter((field) => field.defaultVisible), [fields]);
  const showExpandButton = fields.length > defaultFields.length;
  const filterSchema = useMemo(() => buildFilterSchema(fields, expanded), [fields, expanded]);

  // Stable refs for callbacks
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const handleSearch = useCallback((vals: Record<string, unknown>) => {
    onSearchRef.current(nestFilterValues(vals));
  }, []);

  const handleReset = useCallback(() => {
    setDraftValues({});
    onSearchRef.current({});
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  // Context value updates on every render with latest loading state
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

  useEffect(() => {
    setDraftValues(flattenFilterValues(values));
  }, [values]);

  return (
    <FormActionContext.Provider value={actionsCtx}>
      <FilterSchemaRenderer
        key={expanded ? "expanded" : "collapsed"}
        schema={filterSchema}
        initialValues={draftValues}
        loading={loading}
        onDraftChange={setDraftValues}
      />
    </FormActionContext.Provider>
  );
}
