import { useRef, useState } from "react";
import type { FormInstance, IFormSchema } from "@alien-form/react";
import { Button, Space } from "antd";
import type { SchemaRecord } from "../types/shared";
import { SchemaRenderer } from "./SchemaRenderer";

export interface FilterFormProps {
  /** 已编译的 filter 场景 schema（由 SchemaCompiler.compile 产出）。 */
  filterSchema: IFormSchema;
  dataSource?: SchemaRecord;
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
  filterSchema,
  dataSource,
  loading,
  searchText = "查询",
  onSearch,
  onReset,
}: FilterFormProps) {
  const formRef = useRef<FormInstance | null>(null);
  const initialValuesRef = useRef(dataSource);
  const [expanded, setExpanded] = useState(false);
  const fieldCount = Object.keys(filterSchema.properties ?? {}).length;
  const hasExtraFields = fieldCount > 4;

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
          preserveValuesOnRebuild
          initialValues={initialValuesRef.current}
          onFormReady={(form) => {
            formRef.current = form;
          }}
        />
      </div>
      <div className="af-filter-actions">
        <Space>
          {hasExtraFields ? (
            <Button type="link" onClick={() => setExpanded((current) => !current)}>
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
