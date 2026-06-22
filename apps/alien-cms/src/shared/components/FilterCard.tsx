import { Card } from "antd";
import { SchemaFilterBody } from "../schema-filter-scene";
import type { CmsModelSchema } from "../../domains/record/types/record";

interface FilterCardProps {
  schema: CmsModelSchema;
  initialValues: Record<string, unknown>;
  loading?: boolean;
  defaultVisibleKeys: string[];
  onSearch: (values: Record<string, unknown>) => void;
}

export function FilterCard({
  schema,
  initialValues,
  loading,
  defaultVisibleKeys,
  onSearch,
}: FilterCardProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 16 } }}>
      <SchemaFilterBody
        schema={schema}
        initialValues={initialValues}
        loading={loading}
        defaultVisibleKeys={defaultVisibleKeys}
        onSearch={onSearch}
      />
    </Card>
  );
}

export default FilterCard;
