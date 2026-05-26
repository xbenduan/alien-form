import React from "react";
import type { IField } from "@alien-form/react";

interface SkuTableProps {
  field?: IField;
  rows?: React.ReactNode[][];
  /** Named field slots per row — enables `rowFields[i][columnKey]` access. */
  rowFields?: Record<string, React.ReactNode>[];
  emptyText?: string;
  helperText?: string;
  className?: string;
  onAdd?: (initialValues?: Record<string, any>) => void;
  onRemove?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  disabled?: boolean;
}

function getRowField(rowFields: IField[], name: string): IField | undefined {
  return rowFields.find((f) => f.path.split(".").pop() === name);
}

export const SkuTable: React.FC<SkuTableProps> = ({
  field,
  rows = [],
  rowFields = [],
  emptyText = "请先配置规格值，系统会自动生成 SKU 组合。",
  helperText,
  className,
}) => {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    if (!field) return;
    return field.subscribe(() => forceRender((v) => v + 1));
  }, [field]);

  // Use field.arrayItems for grouping metadata (hidden fields hold group info)
  const arrayItems = field?.arrayItems ?? [];

  const hasImageGrouping = arrayItems.some((rowFields) => {
    const groupSpecName = getRowField(rowFields, "groupSpecName")?.value;
    const groupSpecValue = getRowField(rowFields, "groupSpecValue")?.value;
    return Boolean(groupSpecName && groupSpecValue);
  });

  // Visible column keys (from first row's field list, excluding hidden)
  const visibleColumns = (arrayItems[0] ?? [])
    .filter((f) => f.display !== "none")
    .map((f) => ({ key: f.path.split(".").pop()!, title: f.title }));

  const renderTable = (rowIndices: number[], groupTitle?: string) => (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="min-w-full border-collapse">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-14 border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              #
            </th>
            {visibleColumns.map((col) => (
              <th
                key={`${groupTitle ?? "default"}-${col.key}`}
                className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              >
                {col.title || col.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIndices.map((rowIdx, displayIdx) => {
            const fields = rowFields[rowIdx];
            if (!fields) return null;
            return (
              <tr key={rowIdx} className="align-top">
                <td className="border-b px-3 py-3 text-xs text-muted-foreground">
                  {displayIdx + 1}
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className="border-b px-3 py-2">
                    {fields[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Build index arrays, optionally grouped
  const allIndices = rows.map((_, i) => i);

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
  const groups: Map<
    string,
    { key: string; specName: string; specValue: string; specImage: string; indices: number[] }
  > = new Map();

  arrayItems.forEach((rowFields, idx) => {
    const groupSpecName = String(getRowField(rowFields, "groupSpecName")?.value ?? "");
    const groupSpecValue = String(getRowField(rowFields, "groupSpecValue")?.value ?? "");
    const groupSpecImage = String(getRowField(rowFields, "groupSpecImage")?.value ?? "");
    const groupKey = String(getRowField(rowFields, "groupKey")?.value ?? groupSpecValue);

    const existing = groups.get(groupKey);
    if (existing) {
      existing.indices.push(idx);
    } else {
      groups.set(groupKey, {
        key: groupKey,
        specName: groupSpecName,
        specValue: groupSpecValue,
        specImage: groupSpecImage,
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
                {group.specImage ? (
                  <img
                    src={group.specImage}
                    alt={group.specValue}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">无图片</span>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  {group.specName || "图片规格"}
                </div>
                <div className="text-lg font-semibold">{group.specValue}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  其余销售配置按该规格值分组管理。
                </div>
              </div>
            </div>
            <div className="p-4">{renderTable(group.indices, group.specValue)}</div>
          </div>
        ))}
      </div>
      {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
};
