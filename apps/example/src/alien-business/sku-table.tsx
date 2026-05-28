import React from "react";
import { defineComponent } from "@alien-form/react";
import type { IField } from "@alien-form/react";

const skuSchema = {
  type: "array" as const,
  items: {
    skuKey: { type: "string" },
    groupKey: { type: "string" },
    groupSpecName: { type: "string" },
    groupSpecValue: { type: "string" },
    groupSpecImage: { type: "string" },
    specSummary: { type: "string" },
    price: { type: "number" },
    stock: { type: "number" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    accessories: { type: "array" },
    enabled: { type: "boolean" },
  },
};

interface SkuTableProps {
  emptyText?: string;
  helperText?: string;
  className?: string;
}

function getFieldName(field: IField): string {
  return field.path.split(".").pop() ?? field.path;
}

function getRowFieldValue(rowFields: IField[], name: string): any {
  return rowFields.find((f) => getFieldName(f) === name)?.value;
}

export const SkuTable = defineComponent<typeof skuSchema, SkuTableProps>(
  skuSchema,
)(({
  field,
  rows,
  rowFields,
  emptyText = "请先配置规格值，系统会自动生成 SKU 组合。",
  helperText,
  className,
}) => {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    if (!field) return;
    return field.subscribe(() => forceRender((v) => v + 1));
  }, [field]);

  // Get field metadata from arrayItems for column headers and grouping logic
  const arrayItems = field?.arrayItems ?? [];

  // Determine visible columns from first row's fields (exclude display=none and grouping fields)
  const hiddenFields = new Set(["skuKey", "groupKey", "groupSpecName", "groupSpecValue", "groupSpecImage"]);
  const visibleColumns = (arrayItems[0] ?? []).filter(
    (f) => f.display !== "none" && !hiddenFields.has(getFieldName(f)),
  );

  // Detect image grouping
  const hasImageGrouping = arrayItems.some((rowMeta) => {
    const specName = getRowFieldValue(rowMeta, "groupSpecName");
    const specValue = getRowFieldValue(rowMeta, "groupSpecValue");
    return Boolean(specName && specValue);
  });

  // Render a table for a subset of row indices
  const renderTable = (indices: number[], groupTitle?: string) => (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="min-w-full border-collapse">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-14 border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              #
            </th>
            {visibleColumns.map((col) => (
              <th
                key={`${groupTitle ?? "default"}-${col.path}`}
                className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              >
                {col.title || getFieldName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indices.map((idx, localIndex) => {
            const slotRow = rowFields[idx];
            return (
              <tr key={idx} className="align-top">
                <td className="border-b px-3 py-3 text-xs text-muted-foreground">
                  {localIndex + 1}
                </td>
                {visibleColumns.map((col) => {
                  const name = getFieldName(col);
                  return (
                    <td key={col.path} className="border-b px-3 py-2">
                      {slotRow[name as keyof typeof slotRow]}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Build row indices and grouping
  const allIndices = Array.from({ length: rows.length }, (_, i) => i);

  if (rows.length === 0) {
    return (
      <div className={className}>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
        </div>
        {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }

  if (!hasImageGrouping) {
    return (
      <div className={className}>
        {renderTable(allIndices)}
        {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }

  // Group by image spec
  const groups: Map<string, {
    key: string;
    groupSpecName: string;
    groupSpecValue: string;
    groupSpecImage: string;
    indices: number[];
  }> = new Map();

  arrayItems.forEach((rowMeta, idx) => {
    const groupSpecName = String(getRowFieldValue(rowMeta, "groupSpecName") ?? "");
    const groupSpecValue = String(getRowFieldValue(rowMeta, "groupSpecValue") ?? "");
    const groupSpecImage = String(getRowFieldValue(rowMeta, "groupSpecImage") ?? "");
    const groupKey = String(getRowFieldValue(rowMeta, "groupKey") ?? groupSpecValue);

    const existing = groups.get(groupKey);
    if (existing) {
      existing.indices.push(idx);
    } else {
      groups.set(groupKey, {
        key: groupKey,
        groupSpecName,
        groupSpecValue,
        groupSpecImage,
        indices: [idx],
      });
    }
  });

  return (
    <div className={className}>
      <div className="space-y-4">
        {Array.from(groups.values()).map((group) => (
          <div key={group.key} className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-4 border-b px-4 py-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {group.groupSpecImage ? (
                  <img
                    src={group.groupSpecImage}
                    alt={group.groupSpecValue}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">无图片</span>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  {group.groupSpecName || "图片规格"}
                </div>
                <div className="text-lg font-semibold">{group.groupSpecValue}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  其余销售配置按该规格值分组管理。
                </div>
              </div>
            </div>
            <div className="p-4">{renderTable(group.indices, group.groupSpecValue)}</div>
          </div>
        ))}
      </div>
      {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
});
