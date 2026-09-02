import { CopyOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import type { ModelSummary } from "@app-types";
import type { OpenMode } from "@engine";
import styles from "./index.module.css";

export interface ModelTableProps {
  dataSource: ModelSummary[];
  loading: boolean;
  onCopy: (model: ModelSummary) => void;
  onDelete: (model: ModelSummary) => Promise<void>;
  onEdit: (model: ModelSummary) => void;
  onView: (model: ModelSummary) => void;
}

const OPEN_MODE_LABELS: Record<OpenMode, string> = {
  page: "整页",
  drawer: "抽屉",
  modal: "弹窗",
};

function optionalText(value?: string) {
  return value || "—";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

export function ModelTable({
  dataSource,
  loading,
  onCopy,
  onDelete,
  onEdit,
  onView,
}: ModelTableProps) {
  const columns = useMemo<ColumnsType<ModelSummary>>(
    () => [
      {
        title: "标题",
        dataIndex: "title",
        fixed: "left",
        width: 150,
        render: (title: string, record) => (
          <Button type="link" className={styles.titleLink} onClick={() => onView(record)}>
            {title}
          </Button>
        ),
      },
      {
        title: "模型名",
        dataIndex: "name",
        width: 160,
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      { title: "副标题", dataIndex: "subtitle", width: 160, ellipsis: true, render: optionalText },
      { title: "描述", dataIndex: "description", width: 240, ellipsis: true, render: optionalText },
      {
        title: "分组",
        dataIndex: "group",
        width: 90,
        render: (value?: string) =>
          value === "system" ? <Tag color="blue">系统</Tag> : <Tag>其他</Tag>,
      },
      { title: "单数标签", dataIndex: "singularLabel", width: 120, render: optionalText },
      { title: "复数标签", dataIndex: "pluralLabel", width: 120, render: optionalText },
      { title: "字段数", dataIndex: "fieldCount", width: 90 },
      {
        title: "筛选项数",
        dataIndex: "filterCount",
        width: 100,
        render: (value?: number) => value ?? 4,
      },
      {
        title: "每页条数",
        dataIndex: "defaultPageSize",
        width: 100,
        render: (value?: number) => value ?? 20,
      },
      {
        title: "打开方式",
        dataIndex: "openMode",
        width: 180,
        render: (value: ModelSummary["openMode"]) => (
          <div className={styles.openModes}>
            <span>新增：{OPEN_MODE_LABELS[value?.add ?? "drawer"]}</span>
            <span>编辑：{OPEN_MODE_LABELS[value?.edit ?? "drawer"]}</span>
            <span>详情：{OPEN_MODE_LABELS[value?.detail ?? "drawer"]}</span>
          </div>
        ),
      },
      {
        title: "更新时间",
        dataIndex: "updatedAt",
        width: 180,
        render: formatDateTime,
      },
      {
        title: "操作",
        key: "actions",
        fixed: "right",
        width: 170,
        render: (_, record) => (
          <Space size={0} wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
              编辑
            </Button>
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => onCopy(record)}>
              复制
            </Button>
            <Popconfirm
              title="确认删除该模型吗？"
              description="删除后该模型的数据也会一并清除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={record.name === "_sys_user"}
              onConfirm={() => onDelete(record)}
            >
              <Button
                danger
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                disabled={record.name === "_sys_user"}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onCopy, onDelete, onEdit, onView],
  );

  return (
    <div className={styles.tableCard}>
      <Table<ModelSummary>
        rowKey="name"
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        scroll={{ x: 1800 }}
        pagination={{
          defaultPageSize: 10,
          pageSizeOptions: [10, 20, 50],
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个模型`,
        }}
      />
    </div>
  );
}
