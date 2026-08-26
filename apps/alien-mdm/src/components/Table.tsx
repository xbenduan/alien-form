import type { ReactNode } from "react";
import { Table as AntTable } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import type { SchemaRecord, TableColumn } from "../types/shared";
import { DisplayValue } from "@components/DisplayValue";
import { TableComplexCell } from "@components/complex-frame";

/** 表格不挂载字段组件；统一使用值展示，复杂字段进入独立详情页。 */
function renderCell(column: TableColumn, value: unknown): ReactNode {
  if (column.complex) {
    return <TableComplexCell value={value} schema={column.field} title={column.title} />;
  }
  return (
    <DisplayValue
      value={value}
      dataSource={column.dataSource}
      ellipsis={column.ellipsis}
      format={column.component === "DateInput" ? "date" : undefined}
    />
  );
}

export interface TableColumnAction extends ColumnType<SchemaRecord> {}

export interface TableComponentProps {
  /** 已编译的 table 列（由 SchemaCompiler.compile 产出）。 */
  columns: TableColumn[];
  dataSource: SchemaRecord[];
  loading?: boolean;
  rowKey?: string;
  total?: number;
  pagination?: TableProps<SchemaRecord>["pagination"];
  onChange?: TableProps<SchemaRecord>["onChange"];
  rowSelection?: TableProps<SchemaRecord>["rowSelection"];
  /** 追加的操作列（详情/编辑/删除等）。 */
  actionColumn?: TableColumnAction;
  toolbar?: ReactNode;
}

/** <Table />：接收已编译的列定义 + dataSource。 */
export function Table({
  columns,
  dataSource,
  loading,
  rowKey = "id",
  total,
  pagination,
  onChange,
  rowSelection,
  actionColumn,
  toolbar,
}: TableComponentProps) {
  const antColumns: ColumnsType<SchemaRecord> = columns.map((column) => ({
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    width: column.width,
    ellipsis: column.ellipsis,
    sorter: column.sortable,
    render: (value: unknown) => renderCell(column, value),
  }));
  const finalColumns = actionColumn ? [...antColumns, actionColumn] : antColumns;

  const resolvedPagination: TablePaginationConfig | false =
    pagination === false
      ? false
      : {
          showSizeChanger: true,
          showTotal: (count: number) => `共 ${count} 条`,
          ...(pagination as TablePaginationConfig | undefined),
          ...(typeof total === "number" ? { total } : {}),
        };

  return (
    <div className="af-table">
      {toolbar ? <div className="af-table-toolbar">{toolbar}</div> : null}
      <AntTable<SchemaRecord>
        style={{ marginInline: 16 }}
        rowKey={rowKey}
        columns={finalColumns}
        dataSource={dataSource}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={resolvedPagination}
        onChange={onChange}
        rowSelection={rowSelection}
        locale={{
          emptyText: (
            <div className="af-table-empty">
              <div>当前条件下暂无记录。</div>
            </div>
          ),
        }}
      />
    </div>
  );
}
