import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { App, Alert, Button, Flex, Popconfirm, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "../../components";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";
import styles from "./index.module.css";

export default function ModelListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setModels(await transport.send<ModelSummary[]>("/api/schemas"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<ModelSummary> = [
    {
      title: "标题",
      dataIndex: "title",
      render: (title: string, record) => (
        <Button type="link" onClick={() => navigate(`/records/${record.name}/list`)}>
          {title}
        </Button>
      ),
    },
    { title: "模型名", dataIndex: "name" },
    {
      title: "描述",
      dataIndex: "description",
      ellipsis: true,
      render: (value?: string) => value ?? "—",
    },
    { title: "字段数", dataIndex: "fieldCount", width: 100 },
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
            onClick={() => navigate(`/records/${record.name}/list`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/models/${record.name}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该模型吗？"
            description="删除后该模型的数据也会一并清除。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={record.name === "_sys_user"}
            onConfirm={async () => {
              await transport.send(`/api/schemas/${record.name}`, { method: "DELETE" });
              message.success("删除成功");
              await load();
            }}
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
  ];

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: "模型管理" }]} />
      {error && <Alert type="error" message="模型列表加载失败" description={error} showIcon />}
      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>模型管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label="刷新" />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/models/add")}>
              新增模型
            </Button>
          </Space>
        </div>
        <Table<ModelSummary>
          rowKey="name"
          style={{ marginInline: 16 }}
          columns={columns}
          dataSource={models}
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={false}
        />
      </div>
    </Flex>
  );
}
