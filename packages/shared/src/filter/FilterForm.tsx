import { useRef, useState } from "react";
import type { FormInstance } from "@alien-form/react";
import { Button, Space } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
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
  const { schema: filterSchema, leaves } = useFilterFields(schema);
  const formRef = useRef<FormInstance | null>(null);
  const initialValuesRef = useRef(dataSource);
  const [expanded, setExpanded] = useState(false);
  const hasExtraFields = leaves.length > 4;

  const handleReset = () => {
    formRef.current?.reset();
    (onReset ?? onSearch)({});
  };

  return (
    <div className={`af-filter${expanded || !hasExtraFields ? "" : " af-filter-collapsed"}`}>
      <div className="af-filter-fields">
        <SchemaRenderer
          mode="edit"
          schema={filterSchema}
          formKey="filter"
          initialValues={initialValuesRef.current}
          handlers={handlers}
          onFormReady={(form) => {
            formRef.current = form;
          }}
        />
      </div>
      <div className="af-filter-actions">
        <Space>
          {hasExtraFields ? (
            <Button
              type="link"
              icon={expanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "收起" : "展开"}
            </Button>
          ) : null}
          <Button onClick={handleReset}>重置</Button>
          <Button
            type="primary"
            loading={loading}
            onClick={() => onSearch(formRef.current?.values() ?? {})}
          >
            {searchText}
          </Button>
        </Space>
      </div>
    </div>
  );
}
