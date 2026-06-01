import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { renderTableValue } from '../../core/format/format-value';
import type { ModelRecord, TableColumnProjection } from '../../types/model';

interface ModelTableProps {
  columns: TableColumnProjection[];
  records: ModelRecord[];
  total: number;
  loading?: boolean;
  pagination: { current: number; pageSize: number };
  sorter?: { field?: string; order?: 'ascend' | 'descend' };
  onTableChange: (params: {
    pagination: TablePaginationConfig;
    sorter?: SorterResult<ModelRecord>;
    filters?: Record<string, FilterValue | null>;
  }) => void;
  onDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ModelTable({
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
}: ModelTableProps) {
  const antdColumns: TableColumnsType<ModelRecord> = [
    ...columns.map((column) => ({
      title: column.title,
      dataIndex: column.key,
      key: column.key,
      width: column.width,
      ellipsis: column.ellipsis,
      sorter: true,
      sortOrder: sorter?.field === column.key ? sorter.order : null,
      render: (value: unknown) =>
        renderTableValue(value, {
          format: column.format,
          dataSource: column.dataSource,
          ellipsis: column.ellipsis,
        }),
    })),
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onDetail(record.id)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
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
    <Table<ModelRecord>
      rowKey="id"
      className="model-data-table"
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
  );
}
