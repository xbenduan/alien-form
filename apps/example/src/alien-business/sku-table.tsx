import React from "react";
import { defineComponent } from "@alien-form/react";
import type { IField } from "@alien-form/react";
import { Checkbox, DateInput, Input, ItemInput, Select, Switch } from "@alien-form/ui";

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getFieldName(field: IField): string {
  return field.path.split(".").pop() ?? field.path;
}

function getRowField(rowFields: IField[], name: string): IField | undefined {
  return rowFields.find((field) => getFieldName(field) === name);
}

const SkuFieldCell: React.FC<{ field: IField }> = ({ field }) => {
  const [, forceRender] = React.useState(0);

  React.useEffect(() => field.subscribe(() => forceRender((v) => v + 1)), [field]);

  if (field.display === "none") {
    return <div className="text-sm text-muted-foreground">-</div>;
  }

  const disabled = field.disabled || field.readOnly || field.readPretty;
  const commonClassName = "min-w-[120px] border-0 bg-transparent shadow-none focus-visible:ring-0";

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

export const SkuTable = defineComponent<typeof skuSchema, SkuTableProps>(
  skuSchema,
)(({
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
  const hasImageGrouping = rowGroups.some((rowFields) => {
    const groupSpecName = getRowField(rowFields, "groupSpecName")?.value;
    const groupSpecValue = getRowField(rowFields, "groupSpecValue")?.value;
    return Boolean(groupSpecName && groupSpecValue);
  });

  const renderTable = (tableRows: IField[][], groupTitle?: string) => (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="min-w-full border-collapse">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-14 border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              #
            </th>
            {columns.map((column) => (
              <th
                key={`${groupTitle ?? "default"}-${column.path}`}
                className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              >
                {column.title || column.path.split(".").pop()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((rowFields, index) => (
            <tr key={rowFields[0]?.path ?? index} className="align-top">
              <td className="border-b px-3 py-3 text-xs text-muted-foreground">{index + 1}</td>
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
    </div>
  );

  return (
    <div className={className}>
      {rowGroups.length === 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
        </div>
      ) : hasImageGrouping ? (
        <div className="space-y-4">
          {Array.from(
            rowGroups
              .reduce<
                Map<
                  string,
                  {
                    key: string;
                    groupSpecName: string;
                    groupSpecValue: string;
                    groupSpecImage: string;
                    rows: IField[][];
                  }
                >
              >((groups, rowFields) => {
                const groupSpecName = String(getRowField(rowFields, "groupSpecName")?.value ?? "");
                const groupSpecValue = String(
                  getRowField(rowFields, "groupSpecValue")?.value ?? "",
                );
                const groupSpecImage = String(
                  getRowField(rowFields, "groupSpecImage")?.value ?? "",
                );
                const groupKey = String(
                  getRowField(rowFields, "groupKey")?.value ?? groupSpecValue,
                );
                const existing = groups.get(groupKey);

                if (existing) {
                  existing.rows.push(rowFields);
                } else {
                  groups.set(groupKey, {
                    key: groupKey,
                    groupSpecName,
                    groupSpecValue,
                    groupSpecImage,
                    rows: [rowFields],
                  });
                }

                return groups;
              }, new Map())
              .values(),
          ).map((group) => (
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
              <div className="p-4">{renderTable(group.rows, group.groupSpecValue)}</div>
            </div>
          ))}
        </div>
      ) : (
        renderTable(rowGroups)
      )}
      {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
});
