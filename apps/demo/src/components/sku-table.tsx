import React from "react";
import type { IField } from "@alien-form/core";
import { Checkbox, DateInput, Input, ItemInput, Select, Switch } from "@alien-form/ui";

interface SkuTableProps {
  field?: IField;
  emptyText?: string;
  helperText?: string;
  className?: string;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const SkuFieldCell: React.FC<{ field: IField }> = ({ field }) => {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => field.subscribe(() => forceRender((v) => v + 1)), [field]);

  if (field.display === "none") {
    return <div className="text-sm text-muted-foreground">-</div>;
  }

  const disabled = field.disabled || field.readOnly || field.readPretty;
  const commonClassName =
    "min-w-[120px] border-0 bg-transparent shadow-none focus-visible:ring-0";

  if (field.readPretty) {
    return <div className="min-h-9 py-2 text-sm">{formatCellValue(field.value)}</div>;
  }

  switch (field.component) {
    case "Input":
      return (
        <Input
          {...field.componentProps}
          className={commonClassName}
          type={field.componentProps?.type}
          value={field.value ?? ""}
          disabled={disabled}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const nextValue = event.target.value;
            if (field.componentProps?.type === "number") {
              field.setValue(nextValue === "" ? undefined : Number(nextValue));
              return;
            }
            field.setValue(nextValue);
          }}
        />
      );
    case "Select":
      return (
        <Select
          {...field.componentProps}
          className={commonClassName}
          value={field.value}
          disabled={disabled}
          dataSource={field.dataSource}
          onChange={(value) => field.setValue(value)}
        />
      );
    case "DateInput":
      return (
        <DateInput
          {...field.componentProps}
          className={commonClassName}
          value={field.value ?? ""}
          disabled={disabled}
          onChange={(value) => field.setValue(value)}
        />
      );
    case "ItemInput":
      return (
        <ItemInput
          {...field.componentProps}
          className="min-w-[200px]"
          value={Array.isArray(field.value) ? field.value : []}
          disabled={disabled}
          onChange={(value) => field.setValue(value)}
        />
      );
    case "Checkbox":
      return (
        <div className="flex min-h-9 items-center">
          <Checkbox
            {...field.componentProps}
            value={Boolean(field.value)}
            disabled={disabled}
            label={field.componentProps?.label}
            onChange={(value) => field.setValue(value)}
          />
        </div>
      );
    case "Switch":
      return (
        <div className="flex min-h-9 items-center">
          <Switch
            {...field.componentProps}
            value={Boolean(field.value)}
            disabled={disabled}
            onChange={(value) => field.setValue(value)}
          />
        </div>
      );
    default:
      return <div className="min-h-9 py-2 text-sm">{formatCellValue(field.value)}</div>;
  }
};

export const SkuTable: React.FC<SkuTableProps> = ({
  field,
  emptyText = "请先配置规格值，系统会自动生成 SKU 组合。",
  helperText,
  className,
}) => {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    if (!field) return;
    return field.subscribe(() => forceRender((v) => v + 1));
  }, [field]);

  const rowGroups = field?.arrayItems ?? [];
  const columns = (rowGroups[0] ?? []).filter((column) => column.display !== "none");

  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-lg border bg-background">
        {rowGroups.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <table className="min-w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-14 border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column.path}
                    className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {column.title || column.path.split(".").pop()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowGroups.map((rowFields, index) => (
                <tr key={rowFields[0]?.path ?? index} className="align-top">
                  <td className="border-b px-3 py-3 text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  {rowFields
                    .filter((rowField) => rowField.display !== "none")
                    .map((rowField) => (
                    <td key={rowField.path} className="border-b px-3 py-2">
                      <SkuFieldCell field={rowField} />
                      {rowField.errors.length > 0 && (
                        <div className="mt-1 text-xs text-destructive">
                          {rowField.errors[0]?.message}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
};
