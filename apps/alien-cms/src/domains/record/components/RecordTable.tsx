import { DeleteOutlined, EditOutlined, EyeOutlined } from "../../../shared/ui";
import { Button, Popconfirm, Space, Table, Tag, Typography } from "../../../shared/ui";
import type { TableColumnsType, TablePaginationConfig } from "../../../shared/ui";
import type { FilterValue, SorterResult } from "../../../shared/ui";
import { useState } from "react";
import type { ModelRecord, TableColumnProjection } from "../types/record";
import { FieldDetailDrawer } from "./FieldDetailDrawer";
import { renderTableCell } from "./TableCellRenderer";
import "../../../shared/schema-table-scene/schema-table-scene.css";

interface RecordTableProps {
  columns: TableColumnProjection[];
  records: ModelRecord[];
  total: number;
  loading?: boolean;
  pagination: { current: number; pageSize: number };
  sorter?: { field?: string; order?: "ascend" | "descend" };
  onTableChange: (params: {
    pagination: TablePaginationConfig;
    sorter?: SorterResult<ModelRecord>;
    filters?: Record<string, FilterValue | null>;
  }) => void;
  onDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function RecordTable({
  columns,
  records,
  total,
  loading,
  pagination,
  sorter,
  onTableChange,
  onDetail,
  onEdit,
  onDelete,
}: RecordTableProps) {
  const [fieldDetailState, setFieldDetailState] = useState<{
    column?: TableColumnProjection;
    record?: ModelRecord;
  }>({});

  const antdColumns: TableColumnsType<ModelRecord> = [
    ...columns.map((column) => ({
      title: column.title,
      dataIndex: column.key,
      key: column.key,
      width: column.width,
      ellipsis: column.ellipsis,
      sorter: column.type !== "array" && column.type !== "object" && column.type !== "void",
      sortOrder: sorter?.field === column.key ? sorter.order : null,
      render: (value: unknown, record: ModelRecord) =>
        renderTableCell(column, value, record, (nextColumn, nextRecord) =>
          setFieldDetailState({ column: nextColumn, record: nextRecord }),
        ),
    })),
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onDetail(record.id)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record.id)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条记录吗？"
            description={
              <Typography.Text type="secondary">删除后会立即刷新表格数据。</Typography.Text>
            }
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(record.id)}
          >
            <Button danger type="link" size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table<ModelRecord>
        rowKey="id"
        columns={antdColumns}
        dataSource={records}
        loading={loading}
        locale={{
          emptyText: (
            <div className="table-empty-state">
              <Tag color="default">No Data</Tag>
              <div>当前条件下暂无记录，请调整筛选条件或新建一条数据。</div>
            </div>
          ),
        }}
        scroll={{ x: 1120 }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
        }}
        onChange={(nextPagination, filters, nextSorter) =>
          onTableChange({
            pagination: nextPagination,
            filters,
            sorter: Array.isArray(nextSorter) ? nextSorter[0] : nextSorter,
          })
        }
      />
      <FieldDetailDrawer
        open={Boolean(fieldDetailState.column && fieldDetailState.record)}
        column={fieldDetailState.column}
        record={fieldDetailState.record}
        onClose={() => setFieldDetailState({})}
      />
    </>
  );
}
