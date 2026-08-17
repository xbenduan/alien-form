import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Flex, Popconfirm, Space } from "antd";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ModelSummary } from "../../types";
import { SchemaFilter, SchemaTable } from "@alien-form/shared";
import { schemaQueryKeys, useSchemaStore } from "../../hooks/use-schema-store";
import { buildModelEditPath, buildModelNewPath } from "../../../../app/router/paths";
import { map as recordSchemaHandlers } from "../../../../components/handlers";
import { ModelSchemaJsonModal } from "../../components/ModelSchemaJsonModal";
import { filterDefaultVisibleKeys, filterSchema, tableColumns } from "./schema";

export default function ModelManagementPage() {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const filterInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      name: filters.name,
      title: filters.title,
      description: filters.description,
    }),
    [filters],
  );

  return (
    <Flex vertical gap={16}>
      <Card className="model-query-card" styles={{ body: { padding: 16 } }}>
        <SchemaFilter
          projection={{
            schema: filterSchema,
            defaultVisibleKeys: filterDefaultVisibleKeys,
          }}
          initialValues={filterInitialValues}
          handlers={recordSchemaHandlers}
          loading={loading}
          actions={{
            onSearch: (values) => {
              const next: Record<string, string> = {};
              const name = String(values.name ?? "").trim();
              const title = String(values.title ?? "").trim();
              const description = String(values.description ?? "").trim();
              if (name) next.name = name;
              if (title) next.title = title;
              if (description) next.description = description;
              setFilters(next);
              setPagination((current) => ({ ...current, current: 1 }));
            },
          }}
        />
      </Card>

      {error ? (
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Alert type="error" showIcon message="模型列表加载失败" description={error.message} />
        </Card>
      ) : (
        <SchemaTable
          columns={tableColumns}
          dataSource={list as unknown as Record<string, unknown>[]}
          loading={loading}
          total={total}
          rowKey="name"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 个模型`,
          }}
          onChange={(nextPagination) => {
            setPagination({
              current: nextPagination.current ?? 1,
              pageSize: nextPagination.pageSize ?? pagination.pageSize,
            });
          }}
          actions={{
            addText: "新增模型",
            onAdd: () => navigate(buildModelNewPath()),
            onRefresh: () => {
              void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.all });
            },
          }}
          actionsColumn={{
            title: "操作",
            key: "actions",
            width: 220,
            fixed: "right",
            render: (_, record) => {
              const summary = record as unknown as ModelSummary;
              return (
                <Space size={4} wrap>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewModelName(summary.name)}
                  >
                    查看
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(buildModelEditPath(summary.name))}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title={`确认删除模型 ${summary.title} 吗？`}
                    description="删除后会同时清理该模型的本地记录。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                      await deleteModel(summary.name);
                      messageApi.success("模型删除成功");
                    }}
                  >
                    <Button danger type="link" size="small" icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              );
            },
          }}
        />
      )}

      <ModelSchemaJsonModal
        open={Boolean(previewModelName)}
        modelTitle={getSummary(previewModelName ?? "")?.title}
        schema={previewSchema}
        loading={previewLoading}
        error={previewError}
        onClose={() => setPreviewModelName(undefined)}
      />
    </Flex>
  );
}
