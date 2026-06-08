import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableProps } from "antd";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import type { ModelSummary, SchemaListFilters } from "@alien-form/cms";
import { useSchemaStore } from "../../../hooks/use-schema-store";
import { buildModelEditPath, buildModelNewPath } from "../../../app/router/paths";
import { ModelSchemaJsonModal } from "../components/ModelSchemaJsonModal";

function renderSourceTag(source: ModelSummary["source"]) {
  if (source === "static") {
    return <Tag color="blue">静态</Tag>;
  }

  if (source === "runtime") {
    return <Tag color="green">运行时</Tag>;
  }

  return <Tag>{source}</Tag>;
}

export default function ModelManagementPage() {
  const navigate = useNavigate();
  const { setBreadcrumb } = useWorkbenchLayout();
  const {
    filters,
    setFilters,
    pagination,
    setPagination,
    list,
    total,
    loading,
    error,
    previewModelName,
    setPreviewModelName,
    previewSchema,
    previewLoading,
    previewError,
    getSummary,
    deleteModel,
  } = useSchemaStore();

  const updateFilter = (field: keyof SchemaListFilters, value: string) => {
    setFilters((current) => {
      const nextFilters = { ...current };
      const nextValue = value.trim();

      if (nextValue) {
        nextFilters[field] = nextValue;
      } else {
        delete nextFilters[field];
      }

      return nextFilters;
    });
    setPagination((current) => ({ ...current, current: 1 }));
  };

  useEffect(() => {
    setBreadcrumb({
      items: [{ title: "模型管理" }, { title: "模型列表" }],
    });

    return () => setBreadcrumb(null);
  }, [navigate, setBreadcrumb]);

  const columns: TableProps<ModelSummary>["columns"] = [
    {
      title: "模型",
      key: "model",
      render: (_, record) => (
        <div>
          <Typography.Text strong>{record.title}</Typography.Text>
          <div>
            <Typography.Text type="secondary">{record.name}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 120,
      render: (value: ModelSummary["source"]) => renderSourceTag(value),
    },
    {
      title: "字段数",
      dataIndex: "fieldCount",
      width: 100,
      render: (value?: number) => value ?? "-",
    },
    {
      title: "描述",
      dataIndex: "description",
      ellipsis: true,
      render: (value?: string) => value || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewModelName(record.name)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(buildModelEditPath(record.name))}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确认删除模型 ${record.title} 吗？`}
            description="删除后会同时清理该模型的本地记录。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              await deleteModel(record.name);
              message.success("模型删除成功");
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
    <>
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Row gutter={[20, 20]} align="top" className="model-toolbar-row">
          <Col flex="280px">
            <Input.Search
              allowClear
              value={filters.name ?? ""}
              placeholder="按模型名搜索"
              onChange={(event) => updateFilter("name", event.target.value)}
              onSearch={(value) => updateFilter("name", value)}
            />
          </Col>
          <Col flex="280px">
            <Input.Search
              allowClear
              value={filters.title ?? ""}
              placeholder="按标题搜索"
              onChange={(event) => updateFilter("title", event.target.value)}
              onSearch={(value) => updateFilter("title", value)}
            />
          </Col>
          <Col flex="320px">
            <Input.Search
              allowClear
              value={filters.description ?? ""}
              placeholder="按描述搜索"
              onChange={(event) => updateFilter("description", event.target.value)}
              onSearch={(value) => updateFilter("description", value)}
            />
          </Col>
          <Col flex="auto">
            <div className="model-toolbar-actions model-add-layout">
              <Button type="primary" size="large" onClick={() => navigate(buildModelNewPath())}>
                新增模型
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      <div className="model-table-section">
        {error ? (
          <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
            <Alert type="error" showIcon message="模型列表加载失败" description={error.message} />
          </Card>
        ) : (
          <Table<ModelSummary>
            rowKey="name"
            className="model-data-table"
            columns={columns}
            dataSource={list}
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 个模型`,
            }}
            onChange={(nextPagination) => {
              setPagination({
                current: nextPagination.current ?? 1,
                pageSize: nextPagination.pageSize ?? pagination.pageSize,
              });
            }}
          />
        )}
      </div>

      <ModelSchemaJsonModal
        open={Boolean(previewModelName)}
        modelTitle={getSummary(previewModelName ?? "")?.title}
        schema={previewSchema}
        loading={previewLoading}
        error={previewError}
        onClose={() => setPreviewModelName(undefined)}
      />
    </>
  );
}
