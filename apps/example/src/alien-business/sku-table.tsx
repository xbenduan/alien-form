import type React from "react";
import { useArrayRows, useRenderField, type IField } from "@alien-form/react";

function getFieldName(field: IField): string {
  const segs = field.segments;
  return segs.length > 0 ? segs[segs.length - 1] : field.path;
}

export const SkuTable: React.FC<{
  field: IField;
  disabled?: boolean;
  emptyText?: string;
  helperText?: string;
  className?: string;
}> = ({
  field,
  disabled,
  emptyText = "请先配置规格值，系统会自动生成 SKU 组合。",
  helperText,
  className,
}) => {
  const renderField = useRenderField();
  const rowCount = useArrayRows(field);

  const arrayItems = field.arrayItems ?? [];
  const arrayValue = Array.isArray(field.value) ? field.value : [];

  // Determine visible columns from first row's fields (exclude display=none)
  const hiddenFields = new Set(["skuKey"]);
  const visibleColumns = (arrayItems[0] ?? []).filter(
    (f) => f.display !== "none" && !hiddenFields.has(getFieldName(f)),
  );

  if (arrayValue.length === 0) {
    return (
      <div className={className}>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
        </div>
        {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }

  const allIndices = Array.from({ length: arrayValue.length }, (_, i) => i);

  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-full border-collapse">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-14 border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                #
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.path}
                  className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                >
                  {col.title || getFieldName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allIndices.map((idx, localIndex) => (
              <tr key={idx} className="align-top">
                <td className="border-b px-3 py-3 text-xs text-muted-foreground">
                  {localIndex + 1}
                </td>
                {visibleColumns.map((col) => {
                  const name = getFieldName(col);
                  return (
                    <td key={col.path} className="border-b px-3 py-2">
                      {renderField([field.path, idx, name], { decoratorProps: { label: "", className: "mb-0" } })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
};
