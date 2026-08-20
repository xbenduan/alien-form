import { useNavigate } from "react-router-dom";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { App, Button, Flex, Popconfirm, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { useModelSummaries, useSchemaMutations } from "../../../hooks";
import type { ModelSummary } from "../../../services";
import { modelAddPath, modelEditPath, recordListPath } from "../../../app/router/paths";
import styles from "./index.module.css";

/** 模型列表页：管理所有模型（进入数据、编辑、删除）。 */
export default function ModelListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const query = useModelSummaries();
  const mutations = useSchemaMutations();

  if (query.isLoading) return <PageLoading />;
  if (query.isError) {
    return <PageError title="模型列表加载失败" description={(query.error as Error)?.message} />;
  }

  const columns: ColumnsType<ModelSummary> = [
    {
      title: "标题",
      dataIndex: "title",
      render: (title: string, record) => (
        <Button type="link" onClick={() => navigate(recordListPath(record.name))}>
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
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(recordListPath(record.name))}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(modelEditPath(record.name))}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该模型吗？"
            description="删除后该模型的数据也会一并清除。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              await mutations.deleteModel(record.name);
              message.success("删除成功");
            }}
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
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: "模型管理" }]} />
      <div className={`${styles.listPage} ${styles.tableCard}`}>
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>模型管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => query.refetch()} aria-label="刷新" />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(modelAddPath())}>
              新增模型
            </Button>
          </Space>
        </div>
        <Table<ModelSummary>
          rowKey="name"
          style={{ marginInline: 16 }}
          columns={columns}
          dataSource={query.data ?? []}
          loading={query.isFetching || mutations.deleting}
          pagination={false}
        />
      </div>
    </Flex>
  );
}
