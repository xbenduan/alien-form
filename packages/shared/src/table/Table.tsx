import type { ReactNode } from "react";
import { Table as AntTable, Tag } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import type { SchemaConfig, SchemaRecord, TableColumn } from "../types";
import { fieldComponents } from "../components/registry";
import { DisplayValue } from "../components/DisplayValue";
import { useColumns } from "./use-columns";

/** 依据列定义渲染单元格：复杂列走组件 isTable，叶子列走对应组件的 detail 只读态。 */
function renderCell(column: TableColumn, value: unknown): ReactNode {
  const Component = column.component ? fieldComponents[column.component] : undefined;

  if (column.complex && Component) {
    return (
      <Component value={value} schema={column.field} mode="detail" isTable title={column.title} />
    );
  }
  if (Component) {
    return <Component value={value} dataSource={column.dataSource} mode="detail" />;
  }
  return <DisplayValue value={value} dataSource={column.dataSource} ellipsis={column.ellipsis} />;
}

export interface TableColumnAction extends ColumnType<SchemaRecord> {}

export interface TableComponentProps {
  /** 配置态 schema，内部经 useColumns 转换。 */
  schema: SchemaConfig;
  dataSource: SchemaRecord[];
  loading?: boolean;
  rowKey?: string;
  total?: number;
  pagination?: TableProps<SchemaRecord>["pagination"];
  onChange?: TableProps<SchemaRecord>["onChange"];
  /** 追加的操作列（详情/编辑/删除等）。 */
  actionColumn?: TableColumnAction;
  toolbar?: ReactNode;
}

/** <Table />：只接收 schema + dataSource，自动投影列。 */
export function Table({
  schema,
  dataSource,
  loading,
  rowKey = "id",
  total,
  pagination,
  onChange,
  actionColumn,
  toolbar,
}: TableComponentProps) {
  const columns = useColumns(schema);

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
        locale={{
          emptyText: (
            <div className="af-table-empty">
              <Tag>No Data</Tag>
              <div>当前条件下暂无记录。</div>
            </div>
          ),
        }}
      />
    </div>
  );
}
