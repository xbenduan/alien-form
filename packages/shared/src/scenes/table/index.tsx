import { ProfileOutlined } from "@ant-design/icons";
import { Button, Table, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType, TablePaginationConfig, TableProps } from "antd";
import type { ColumnType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import * as adapters from "../../adapters";
import { createAdapterCatalog, createAdapterRegistry, resolveSceneRender } from "../../adapter";
import type { SchemaRecord, TableColumnProjection, TableInlineProjection } from "../../types";

const tableAdapters = {
  DisplayText: adapters.DisplayTextAdapter,
  DisplayChoice: adapters.DisplayChoiceAdapter,
  DisplayBoolean: adapters.DisplayBooleanAdapter,
  DisplayDate: adapters.DisplayDateAdapter,
  DisplayRate: adapters.DisplayRateAdapter,
  DisplayTags: adapters.DisplayTagsAdapter,
  getDisplaySummary: adapters.getDisplaySummaryAdapter,
};

const tableCatalogAdapters = {
  ...tableAdapters,
  Input: adapters.InputAdapter,
  Textarea: adapters.TextareaAdapter,
  NumberInput: adapters.NumberInputAdapter,
  Select: adapters.SelectAdapter,
  Switch: adapters.SwitchAdapter,
  DateInput: adapters.DateInputAdapter,
  Radio: adapters.RadioAdapter,
  CheckboxGroup: adapters.CheckboxGroupAdapter,
  Rate: adapters.RateAdapter,
  TagsInput: adapters.TagsInputAdapter,
};

const tableMap = createAdapterRegistry(tableAdapters);
const tableCatalog = createAdapterCatalog(tableCatalogAdapters);

function renderSimpleValue(
  value: unknown,
  options: {
    format?: string;
    dataSource?: TableColumnProjection["dataSource"];
    ellipsis?: boolean;
  } = {},
) {
  const summary = tableMap.getDisplaySummary({
    value,
    format: options.format,
    dataSource: options.dataSource,
  });

  if (summary.kind === "status") {
    return <Tag color={summary.color}>{summary.text}</Tag>;
  }

  return (
    <Typography.Text
      style={{ display: "block", width: "100%" }}
      ellipsis={options.ellipsis ? { tooltip: summary.fullText ?? summary.text } : false}
    >
      {summary.text}
    </Typography.Text>
  );
}

function getInlineDisplayText(value: unknown, projection?: TableInlineProjection) {
  if (value === null || value === undefined || value === "") return null;

  const normalizedDateValue =
    typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : value;

  if (typeof value === "boolean" || projection?.format === "boolean") {
    return value ? "是" : "否";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => projection?.dataSource?.find((option) => option.value === item)?.label ?? item)
      .filter((item) => item !== null && item !== undefined && item !== "");
    return items.length > 0 ? items.join(", ") : null;
  }

  if (projection?.format === "date") {
    return String(normalizedDateValue).slice(0, 10);
  }
  if (projection?.format === "dateTime") {
    return String(normalizedDateValue).slice(0, 16).replace("T", " ");
  }

  return String(projection?.dataSource?.find((option) => option.value === value)?.label ?? value);
}

function getInlineProjection(column: TableColumnProjection): TableInlineProjection[] {
  if (column.inline?.length) return column.inline;

  return Object.keys(column.field.properties ?? {})
    .slice(0, 3)
    .map((key) => ({
      key,
      dataSource: column.field.properties?.[key]?.dataSource,
    }));
}

function buildInlineTokens(source: SchemaRecord, projections: TableInlineProjection[]) {
  return projections
    .map((projection) => getInlineDisplayText(source[projection.key], projection))
    .filter((item): item is string => Boolean(item));
}

export function buildObjectSummary(
  column: TableColumnProjection,
  value: unknown,
  record: SchemaRecord,
) {
  const source = column.field["x-layout"]
    ? record
    : value && typeof value === "object" && !Array.isArray(value)
      ? (value as SchemaRecord)
      : undefined;
  if (!source) return "—";

  const tokens = buildInlineTokens(source, getInlineProjection(column));
  if (tokens.length > 0) return tokens.join(" · ");

  const count = Object.values(source).filter(
    (item) => item !== null && item !== undefined && item !== "",
  ).length;
  return count > 0 ? `已配置 ${count} 项` : "—";
}

function buildScalarArraySummary(items: unknown[]) {
  if (items.length === 0) return "—";

  return (
    <>
      {items.slice(0, 2).map((item, index) => (
        <Tag key={`${String(item)}:${index}`}>{String(item)}</Tag>
      ))}
      {items.length > 2 ? (
        <Typography.Text type="secondary">+{items.length - 2}</Typography.Text>
      ) : null}
    </>
  );
}

export function buildArraySummary(column: TableColumnProjection, value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";

  const scalarItems = value.filter(
    (item) => item === null || ["string", "number", "boolean"].includes(typeof item),
  );
  if (scalarItems.length === value.length) {
    return buildScalarArraySummary(scalarItems);
  }

  const objectItems = value.filter(
    (item): item is SchemaRecord =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
  if (objectItems.length !== value.length) return `共 ${value.length} 项`;

  const projections = getInlineProjection(column);
  const itemSummaries = objectItems
    .slice(0, 2)
    .map((item) => buildInlineTokens(item, projections).join(" · "))
    .filter(Boolean);
  if (itemSummaries.length === 0) return `共 ${value.length} 项`;

  const suffix = value.length > 2 ? ` +${value.length - 2}` : "";
  return `${itemSummaries.join(" / ")}${suffix}`;
}

function isExpandableColumn(column: TableColumnProjection) {
  if (typeof column.expandable === "boolean") return column.expandable;
  return Boolean(column.type === "array" || column.type === "object" || column.field["x-layout"]);
}

export function renderTableCell(
  column: TableColumnProjection,
  value: unknown,
  record: SchemaRecord,
  onOpenDetail?: (column: TableColumnProjection, record: SchemaRecord) => void,
) {
  const sceneRender = resolveSceneRender(column.field, "table", tableCatalog);
  if (sceneRender) {
    const summary = tableMap.getDisplaySummary({
      value,
      format: column.format,
      dataSource: column.dataSource,
    });
    return (
      <div className="table-cell-complex">
        <div className="table-cell-summary">{renderSimpleValue(value, column)}</div>
        {summary.expandable && onOpenDetail ? (
          <Tooltip title={`点击查看${column.title}全部内容`}>
            <Button
              type="link"
              size="small"
              icon={<ProfileOutlined />}
              aria-label={`查看${column.title}全部内容`}
              onClick={() => onOpenDetail(column, record)}
            />
          </Tooltip>
        ) : null}
      </div>
    );
  }

  const summary =
    column.type === "array"
      ? buildArraySummary(column, value)
      : buildObjectSummary(column, value, record);

  return (
    <div className="table-cell-complex">
      <div className="table-cell-summary">
        {typeof summary === "string" ? (
          <Typography.Text ellipsis={column.ellipsis ? { tooltip: summary } : false}>
            {summary}
          </Typography.Text>
        ) : (
          summary
        )}
      </div>
      {isExpandableColumn(column) && onOpenDetail ? (
        <Tooltip title={`点击查看${column.title}详情`}>
          <Button
            type="link"
            size="small"
            icon={<ProfileOutlined />}
            aria-label={`查看${column.title}详情`}
            onClick={() => onOpenDetail(column, record)}
          />
        </Tooltip>
      ) : null}
    </div>
  );
}

export interface TableSceneProps {
  columns: TableColumnProjection[];
  dataSource: SchemaRecord[];
  loading?: boolean;
  total?: number;
  pagination?: TablePaginationConfig | false;
  rowKey?: string;
  rowSelection?: TableRowSelection<SchemaRecord>;
  sorter?: { field?: string; order?: "ascend" | "descend" };
  onChange?: TableProps<SchemaRecord>["onChange"];
  actionsColumn?: ColumnType<SchemaRecord>;
  onOpenDetail?: (column: TableColumnProjection, record: SchemaRecord) => void;
}

export function TableScene({
  columns,
  dataSource,
  loading,
  total,
  pagination,
  rowKey = "id",
  rowSelection,
  sorter,
  onChange,
  actionsColumn,
  onOpenDetail,
}: TableSceneProps) {
  const baseColumns: TableColumnsType<SchemaRecord> = columns.map((column) => ({
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    width: column.width,
    ellipsis: column.ellipsis,
    sorter: column.sortable,
    sortOrder: sorter?.field === column.key ? sorter.order : null,
    render: (value: unknown, record: SchemaRecord) =>
      renderTableCell(column, value, record, onOpenDetail),
  }));
  const tableColumns = actionsColumn ? [...baseColumns, actionsColumn] : baseColumns;
  const resolvedPagination =
    pagination === false
      ? (false as const)
      : {
          showSizeChanger: true,
          showTotal: (count: number) => `共 ${count} 条`,
          ...pagination,
          ...(typeof total === "number" ? { total } : {}),
        };

  return (
    <Table<SchemaRecord>
      rowKey={rowKey}
      columns={tableColumns}
      dataSource={dataSource}
      loading={loading}
      rowSelection={rowSelection}
      locale={{
        emptyText: (
          <div className="table-empty-state">
            <Tag color="default">No Data</Tag>
            <div>当前条件下暂无记录，请调整筛选条件或新建一条数据。</div>
          </div>
        ),
      }}
      scroll={{ x: "max-content" }}
      pagination={resolvedPagination}
      onChange={onChange}
    />
  );
}
