import { SchemaFilterBody } from "../../../shared/schema-filter-scene";
import type { CmsModelSchema } from "../types/record";

interface RecordFilterBarProps {
  schema: CmsModelSchema;
  defaultVisibleKeys: string[];
  values: Record<string, unknown>;
  loading?: boolean;
  onSearch: (values: Record<string, unknown>) => void;
}

export function RecordFilterBar({
  schema,
  defaultVisibleKeys,
  values,
  loading,
  onSearch,
}: RecordFilterBarProps) {
  return (
    <SchemaFilterBody
      schema={schema}
      defaultVisibleKeys={defaultVisibleKeys}
      initialValues={values}
      loading={loading}
      onSearch={onSearch}
    />
  );
}
