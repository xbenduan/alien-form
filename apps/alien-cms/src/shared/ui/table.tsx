import { useEffect, useState, type CSSProperties, type Key, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Empty, Spin } from "./display";
import type {
  ColumnType,
  SorterResult,
  SortOrder,
  TableProps,
} from "./table-types";

function toPixel(value?: number | string) {
  if (typeof value === "number") return `${value}px`;
  return value;
}

function sumNumericColumnWidths<T>(columns: ColumnType<T>[], selectionWidth = 0) {
  const width = columns.reduce((total, column) => {
    const resolvedWidth =
      "resolvedWidth" in column
        ? (column as ColumnType<T> & { resolvedWidth?: number | string }).resolvedWidth
        : column.width;
    return total + (typeof resolvedWidth === "number" ? resolvedWidth : 0);
  }, selectionWidth);
  return width > selectionWidth ? width : undefined;
}

function appendCssSize(base: string, size?: number | string) {
  if (size === undefined) return base;
  const next = toPixel(size);
  if (!next) return base;
  if (base === "0px") return next;
  return `calc(${base} + ${next})`;
}

function isActionColumn<T>(column: ColumnType<T>) {
  const values = [column.key, column.dataIndex, typeof column.title === "string" ? column.title : undefined]
    .flat()
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    ["action", "actions", "operation", "operations", "操作", "动作"].includes(value),
  );
}

type ResolvedColumn<T> = ColumnType<T> & {
  fixed?: "left" | "right";
  resolvedWidth?: number | string;
  stickyLeft?: string;
  stickyRight?: string;
  isLastLeftFixed?: boolean;
  isFirstRightFixed?: boolean;
};

function resolveColumns<T>(columns: ColumnType<T>[], leftBaseOffset = 0) {
  const resolved = columns.map<ResolvedColumn<T>>((column) => {
    const fixed = column.fixed ?? (isActionColumn(column) ? "right" : undefined);
    return {
      ...column,
      fixed,
      resolvedWidth: column.width ?? (fixed ? 160 : undefined),
    };
  });

  let leftOffset = leftBaseOffset ? `${leftBaseOffset}px` : "0px";
  for (const column of resolved) {
    if (column.fixed !== "left") continue;
    column.stickyLeft = leftOffset;
    leftOffset = appendCssSize(leftOffset, column.resolvedWidth);
  }

  let rightOffset = "0px";
  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    const column = resolved[index];
    if (column.fixed !== "right") continue;
    column.stickyRight = rightOffset;
    rightOffset = appendCssSize(rightOffset, column.resolvedWidth);
  }

  const lastLeftIndex = resolved.map((column) => column.fixed).lastIndexOf("left");
  const firstRightIndex = resolved.findIndex((column) => column.fixed === "right");
  if (lastLeftIndex >= 0) resolved[lastLeftIndex].isLastLeftFixed = true;
  if (firstRightIndex >= 0) resolved[firstRightIndex].isFirstRightFixed = true;

  return resolved;
}

function getFixedCellClass<T>(column: ResolvedColumn<T>, isHeader = false) {
  if (!column.fixed) return undefined;
  return cn(
    "sticky bg-[rgba(255,252,248,0.96)]",
    isHeader && "z-30 bg-[rgba(244,236,227,0.96)]",
    !isHeader && "z-20",
    column.isLastLeftFixed && "shadow-[8px_0_14px_-14px_rgba(68,49,33,0.5)]",
    column.isFirstRightFixed && "shadow-[-8px_0_14px_-14px_rgba(68,49,33,0.5)]",
  );
}

function getFixedCellStyle<T>(column: ResolvedColumn<T>): CSSProperties {
  return {
    width: toPixel(column.resolvedWidth),
    minWidth: toPixel(column.resolvedWidth),
    left: column.fixed === "left" ? column.stickyLeft : undefined,
    right: column.fixed === "right" ? column.stickyRight : undefined,
  };
}

function resolveRowKey<T>(
  record: T,
  rowKey: string | ((record: T) => Key),
  index: number,
) {
  if (typeof rowKey === "function") {
    return rowKey(record);
  }
  if (record && typeof record === "object" && rowKey in (record as Record<string, unknown>)) {
    return (record as Record<string, Key>)[rowKey];
  }
  return index;
}

function readCellValue<T>(record: T, dataIndex: ColumnType<T>["dataIndex"]) {
  if (!dataIndex) return undefined;
  const path = Array.isArray(dataIndex) ? dataIndex : String(dataIndex).split(".");
  let current: unknown = record;
  for (const segment of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

function sortData<T>(data: T[], sorter?: SorterResult<T>) {
  if (!sorter?.order || !sorter.field) return data;
  const direction = sorter.order === "ascend" ? 1 : -1;
  return [...data].sort((left, right) => {
    const leftValue = readCellValue(left, sorter.field as string);
    const rightValue = readCellValue(right, sorter.field as string);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return -1 * direction;
    if (rightValue == null) return 1 * direction;
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  });
}

export function Table<T extends object>({
  rowKey = "key",
  columns = [],
  dataSource = [],
  loading,
  locale,
  pagination = false,
  rowSelection,
  onChange,
  size = "middle",
  scroll,
}: TableProps<T>) {
  const [internalPage, setInternalPage] = useState(
    pagination === false ? 1 : (pagination.current ?? 1),
  );
  const [internalPageSize, setInternalPageSize] = useState(
    pagination === false ? dataSource.length || 10 : (pagination.pageSize ?? 10),
  );
  const [internalSorter, setInternalSorter] = useState<SorterResult<T>>();

  useEffect(() => {
    if (pagination !== false) {
      setInternalPage(pagination.current ?? 1);
      setInternalPageSize(pagination.pageSize ?? 10);
    }
  }, [pagination]);

  const controlledColumn = columns.find((column) => column.sortOrder);
  const controlledSorter = controlledColumn?.sortOrder
    ? {
        field: (controlledColumn.dataIndex ?? controlledColumn.key) as string,
        order: controlledColumn.sortOrder ?? undefined,
      }
    : undefined;
  const activeSorter = controlledSorter ?? internalSorter;
  const sortedData = sortData(dataSource, activeSorter);
  const selectionColumnWidth = rowSelection ? 44 : 0;
  const hasLeftFixedColumn = columns.some((column) => column.fixed === "left");
  const resolvedColumns = resolveColumns(
    columns,
    hasLeftFixedColumn ? selectionColumnWidth : 0,
  );
  const shouldFixSelectionColumn = !!rowSelection && hasLeftFixedColumn;
  const page = pagination === false ? 1 : internalPage;
  const pageSize = pagination === false ? sortedData.length || internalPageSize : internalPageSize;
  const total = pagination === false ? sortedData.length : (pagination.total ?? sortedData.length);
  const start = pagination === false ? 0 : (page - 1) * pageSize;
  const currentData = pagination === false ? sortedData : sortedData.slice(start, start + pageSize);
  const selectedRowKeys = rowSelection?.selectedRowKeys ?? [];
  const rowMap = new Map(
    dataSource.map((record, index) => [resolveRowKey(record, rowKey, index), record]),
  );

  const toggleSort = (column: ColumnType<T>) => {
    if (!column.sorter) return;
    const key = (column.dataIndex ?? column.key) as string;
    const currentOrder =
      activeSorter?.field === key ? activeSorter.order : (column.sortOrder ?? undefined);
    const nextOrder: SortOrder | undefined =
      currentOrder === "ascend"
        ? "descend"
        : currentOrder === "descend"
          ? undefined
          : "ascend";
    const nextSorter: SorterResult<T> = {
      field: key,
      order: nextOrder,
      column,
      columnKey: column.key,
    };
    setInternalSorter(nextSorter);
    onChange?.(
      {
        current: 1,
        pageSize,
        total,
        showSizeChanger: pagination !== false ? pagination.showSizeChanger : false,
        showTotal: pagination !== false ? pagination.showTotal : undefined,
      },
      {},
      nextSorter,
    );
    setInternalPage(1);
  };

  const updateSelection = (nextKeys: Key[]) => {
    rowSelection?.onChange?.(
      nextKeys,
      nextKeys.map((key) => rowMap.get(key)).filter(Boolean) as T[],
    );
  };

  const allPageRowKeys = currentData.map((record, index) =>
    resolveRowKey(record, rowKey, start + index),
  );
  const allChecked =
    allPageRowKeys.length > 0 && allPageRowKeys.every((key) => selectedRowKeys.includes(key));
  const computedColumnWidth = sumNumericColumnWidths(resolvedColumns, selectionColumnWidth);
  const horizontalScrollWidth = toPixel(scroll?.x);
  const tableWidth = horizontalScrollWidth ?? "100%";
  const tableMinWidth = horizontalScrollWidth ?? (computedColumnWidth ? `${computedColumnWidth}px` : "100%");
  const selectionColumnStyle: CSSProperties | undefined = shouldFixSelectionColumn
    ? { left: 0, width: selectionColumnWidth, minWidth: selectionColumnWidth }
    : undefined;

  return (
    <div className="ant-table-wrapper">
      <div className="overflow-hidden rounded-[14px] border border-[rgba(120,98,79,0.12)] bg-[rgba(255,252,248,0.82)]">
        <div className="overflow-auto" style={{ maxHeight: toPixel(scroll?.y) }}>
          <table
            className="ant-table border-collapse"
            style={{ width: tableWidth, minWidth: tableMinWidth }}
          >
            <colgroup>
              {rowSelection ? <col style={{ width: selectionColumnWidth }} /> : null}
              {resolvedColumns.map((column, index) => (
                <col
                  key={String(column.key ?? column.dataIndex ?? index)}
                  style={{ width: toPixel(column.resolvedWidth) }}
                />
              ))}
            </colgroup>
            <thead className="ant-table-thead bg-[rgba(244,236,227,0.78)]">
              <tr>
                {rowSelection ? (
                  <th
                    className={cn(
                      "relative w-11 whitespace-nowrap border-b border-[rgba(120,98,79,0.12)] px-3 py-2.5 text-left",
                      resolvedColumns.length > 0 &&
                        "after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-[rgba(120,98,79,0.18)] after:content-['']",
                      shouldFixSelectionColumn &&
                        "sticky left-0 z-30 bg-[rgba(244,236,227,0.96)] shadow-[8px_0_14px_-14px_rgba(68,49,33,0.5)]",
                    )}
                    style={selectionColumnStyle}
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--af-primary,#C96442)]"
                      checked={allChecked}
                      onChange={(event) =>
                        updateSelection(
                          event.target.checked
                            ? Array.from(new Set([...selectedRowKeys, ...allPageRowKeys]))
                            : selectedRowKeys.filter((key) => !allPageRowKeys.includes(key)),
                        )
                      }
                    />
                  </th>
                ) : null}
                {resolvedColumns.map((column, index) => {
                  const key = String(column.key ?? column.dataIndex ?? index);
                  const columnOrder =
                    activeSorter?.field === (column.dataIndex ?? column.key)
                      ? activeSorter?.order
                      : (column.sortOrder ?? undefined);
                  return (
                    <th
                      key={key}
                      className={cn(
                        "relative whitespace-nowrap border-b border-[rgba(120,98,79,0.12)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[rgba(80,63,50,0.58)]",
                        column.sorter && "cursor-pointer select-none",
                        index < resolvedColumns.length - 1 &&
                          "after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-[rgba(120,98,79,0.18)] after:content-['']",
                        getFixedCellClass(column, true),
                      )}
                      style={getFixedCellStyle(column)}
                      onClick={() => toggleSort(column)}
                    >
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {column.title}
                        {column.sorter ? (
                          <span className="text-[10px]">
                            {columnOrder === "ascend"
                              ? "↑"
                              : columnOrder === "descend"
                                ? "↓"
                                : "↕"}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="ant-table-tbody">
              {loading ? (
                <tr>
                  <td
                    colSpan={resolvedColumns.length + (rowSelection ? 1 : 0)}
                    className="px-3 py-8 text-center"
                  >
                    <Spin size={size === "small" ? "small" : "large"} />
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={resolvedColumns.length + (rowSelection ? 1 : 0)} className="px-3 py-6">
                    {locale?.emptyText ?? <Empty />}
                  </td>
                </tr>
              ) : (
                currentData.map((record, rowIndex) => {
                  const key = resolveRowKey(record, rowKey, start + rowIndex);
                  return (
                    <tr
                      key={String(key)}
                      className="last:[&_td]:after:hidden"
                    >
                      {rowSelection ? (
                        <td
                          className={cn(
                            "relative px-3 py-2.5 align-top after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[rgba(120,98,79,0.08)] after:content-['']",
                            shouldFixSelectionColumn &&
                              "sticky left-0 z-20 bg-[rgba(255,252,248,0.96)] shadow-[8px_0_14px_-14px_rgba(68,49,33,0.5)]",
                          )}
                          style={selectionColumnStyle}
                        >
                          <input
                            type="checkbox"
                            className="accent-[var(--af-primary,#C96442)]"
                            checked={selectedRowKeys.includes(key)}
                            onChange={(event) => {
                              const nextKeys = event.target.checked
                                ? [...selectedRowKeys, key]
                                : selectedRowKeys.filter((item) => item !== key);
                              updateSelection(Array.from(new Set(nextKeys)));
                            }}
                          />
                        </td>
                      ) : null}
                      {resolvedColumns.map((column, columnIndex) => {
                        const cellValue = readCellValue(record, column.dataIndex);
                        const rendered = (column.render?.(cellValue, record, rowIndex) ??
                          cellValue ??
                          "—") as ReactNode;
                        return (
                          <td
                            key={String(column.key ?? column.dataIndex ?? columnIndex)}
                            className={cn(
                              "relative px-3 py-2.5 align-top text-sm text-[var(--af-text,#2f261f)] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[rgba(120,98,79,0.08)] after:content-['']",
                              getFixedCellClass(column),
                            )}
                            style={getFixedCellStyle(column)}
                            title={
                              column.ellipsis && typeof rendered === "string" ? rendered : undefined
                            }
                          >
                            {column.ellipsis ? (
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                {rendered}
                              </div>
                            ) : (
                              rendered
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {pagination !== false ? (
        <div className="ant-table-pagination mt-3 flex flex-wrap items-center justify-between gap-2.5 text-sm text-[rgba(80,63,50,0.68)]">
          <div>
            {pagination.showTotal
              ? pagination.showTotal(total, [
                  Math.min(start + 1, total),
                  Math.min(start + currentData.length, total),
                ])
              : `共 ${total} 条`}
          </div>
          <div className="flex items-center gap-2">
            {pagination.showSizeChanger ? (
              <select
                className="rounded-[8px] border border-[rgba(120,98,79,0.16)] bg-white/85 px-2 py-1"
                value={pageSize}
                onChange={(event) => {
                  const nextPageSize = Number(event.target.value);
                  setInternalPageSize(nextPageSize);
                  setInternalPage(1);
                  onChange?.(
                    { ...pagination, current: 1, pageSize: nextPageSize, total },
                    {},
                    (activeSorter ?? undefined) as SorterResult<T>,
                  );
                }}
              >
                {[10, 20, 50, 100].map((option) => (
                  <option key={option} value={option}>
                    {option} / 页
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              size="small"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setInternalPage(nextPage);
                onChange?.(
                  { ...pagination, current: nextPage, pageSize, total },
                  {},
                  (activeSorter ?? undefined) as SorterResult<T>,
                );
              }}
            >
              上一页
            </Button>
            <span>
              第 {page} / {Math.max(1, Math.ceil(total / Math.max(1, pageSize)))} 页
            </span>
            <Button
              size="small"
              disabled={page >= Math.ceil(total / Math.max(1, pageSize))}
              onClick={() => {
                const nextPage = Math.min(
                  Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
                  page + 1,
                );
                setInternalPage(nextPage);
                onChange?.(
                  { ...pagination, current: nextPage, pageSize, total },
                  {},
                  (activeSorter ?? undefined) as SorterResult<T>,
                );
              }}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type {
  ColumnType,
  ColumnsType,
  FilterValue,
  SortOrder,
  SorterResult,
  TableColumnsType,
  TableLocale,
  TablePaginationConfig,
  TableProps,
  TableRowSelection,
} from "./table-types";
