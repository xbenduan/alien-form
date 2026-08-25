import type { ReactNode } from "react";
import { Suspense } from "react";
import { Table as AntTable } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import type { SchemaRecord, TableColumn } from "../types/shared";
import { fieldComponents } from "../register/global/form/registry";
import { DisplayValue } from "../components/DisplayValue";

/** 依据列定义渲染单元格：复杂列走组件 isTable，叶子列走对应组件的 detail 只读态。 */
function renderCell(column: TableColumn, value: unknown): ReactNode {
  const Component = column.component ? fieldComponents[column.component] : undefined;

  if (column.complex && Component) {
    return (
      <Suspense fallback={<DisplayValue value={value} ellipsis={column.ellipsis} />}>
        <Component value={value} schema={column.field} mode="detail" isTable title={column.title} />
      </Suspense>
    );
  }
  if (Component) {
    return (
      <Suspense fallback={<DisplayValue value={value} dataSource={column.dataSource} />}>
        <Component value={value} dataSource={column.dataSource} mode="detail" />
      </Suspense>
    );
  }
  return <DisplayValue value={value} dataSource={column.dataSource} ellipsis={column.ellipsis} />;
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
