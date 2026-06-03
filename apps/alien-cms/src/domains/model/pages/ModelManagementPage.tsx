import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Breadcrumb, Button, Card, Input, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ModelSummary } from '@alien-form/cms';
import { useSchemaStore } from '../../../hooks/use-schema-store';
import { buildModelEditPath, buildModelNewPath } from '../../../app/router/paths';
import { ModelSchemaJsonModal } from '../components/ModelSchemaJsonModal';

function renderSourceTag(source: ModelSummary['source']) {
  if (source === 'static') {
    return <Tag color="blue">静态</Tag>;
  }

  if (source === 'runtime') {
    return <Tag color="green">运行时</Tag>;
  }

  return <Tag>{source}</Tag>;
}

export default function ModelManagementPage() {
  const navigate = useNavigate();
  const {
    keyword,
    setKeyword,
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

  const columns: TableProps<ModelSummary>['columns'] = [
    {
      title: '模型',
      key: 'model',
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
      title: '来源',
      dataIndex: 'source',
      width: 120,
      render: (value: ModelSummary['source']) => renderSourceTag(value),
    },
    {
      title: '字段数',
      dataIndex: 'fieldCount',
      width: 100,
      render: (value?: number) => value ?? '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewModelName(record.name)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(buildModelEditPath(record.name))}>
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
              message.success('模型删除成功');
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
      <div className="model-breadcrumb-bar">
        <div className="model-breadcrumb-content">
          <Breadcrumb items={[{ title: '模型管理' }, { title: '模型列表' }]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(buildModelNewPath())}>
            新增模型
          </Button>
        </div>
      </div>

      <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            value={keyword}
            placeholder="搜索模型名、标题、描述"
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => {
              setKeyword(value);
              setPagination((current) => ({ ...current, current: 1 }));
            }}
          />
          {error ? (
            <Alert type="error" showIcon message="模型列表加载失败" description={error.message} />
          ) : (
            <Table<ModelSummary>
              rowKey="name"
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
        </Space>
      </Card>

      <ModelSchemaJsonModal
        open={Boolean(previewModelName)}
        modelTitle={getSummary(previewModelName ?? '')?.title}
        schema={previewSchema}
        loading={previewLoading}
        error={previewError}
        onClose={() => setPreviewModelName(undefined)}
      />
    </>
  );
}
