import { useRef } from "react";
import type { FormInstance } from "@alien-form/react";
import { Button, Space } from "antd";
import type { SchemaConfig, SchemaHandlers, SchemaRecord } from "../types";
import { SchemaRenderer } from "../components/SchemaRenderer";
import { useFilterFields } from "./use-filter-fields";

export interface FilterFormProps {
  schema: SchemaConfig;
  dataSource?: SchemaRecord;
  handlers?: SchemaHandlers;
  loading?: boolean;
  searchText?: string;
  onSearch: (values: SchemaRecord) => void;
  onReset?: () => void;
}

/**
 * <FilterForm />：渲染所有叶子字段的查询表单。
 * 与 form 的差异：无校验（叶子字段不带 x-validate），装饰器为 FilterItem。
 */
export function FilterForm({
  schema,
  dataSource,
  handlers,
  loading,
  searchText = "查询",
  onSearch,
  onReset,
}: FilterFormProps) {
  const { schema: filterSchema } = useFilterFields(schema);
  const formRef = useRef<FormInstance | null>(null);

  const handleReset = () => {
    formRef.current?.reset();
    (onReset ?? onSearch)({});
  };

  return (
    <div className="af-filter">
      <div className="af-filter-fields">
        <SchemaRenderer
          mode="edit"
          schema={filterSchema}
          initialValues={dataSource}
          handlers={handlers}
          onFormReady={(form) => {
            formRef.current = form;
          }}
        />
      </div>
      <div className="af-filter-actions">
        <Space>
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" loading={loading} onClick={() => onSearch(formRef.current?.values() ?? {})}>
            {searchText}
          </Button>
        </Space>
      </div>
    </div>
  );
}
