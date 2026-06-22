import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Flex,
  Popconfirm,
  Space,
  message,
} from "antd";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ModelSummary } from "@alien-form/cms";
import { schemaQueryKeys, useSchemaStore } from "../../../../hooks/use-schema-store";
import { buildModelEditPath, buildModelNewPath } from "../../../../app/router/paths";
import { ModelSchemaJsonModal } from "../../components/ModelSchemaJsonModal";
import { FilterCard } from "../../../../shared/components/FilterCard";
import { ProTable } from "../../../../shared/components/ProTable";
import type { ModelRecord } from "../../../record/types/record";
import { filterDefaultVisibleKeys, filterSchema, tableColumns } from "./schema";

export default function ModelManagementPage() {
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
      <FilterCard
        schema={filterSchema}
        initialValues={filterInitialValues}
        loading={loading}
        defaultVisibleKeys={filterDefaultVisibleKeys}
        onSearch={(values) => {
          const next: Record<string, string> = {};
          const name = String(values.name ?? "").trim();
          const title = String(values.title ?? "").trim();
          const description = String(values.description ?? "").trim();
          if (name) next.name = name;
          if (title) next.title = title;
          if (description) next.description = description;
          setFilters(next);
          setPagination((current) => ({ ...current, current: 1 }));
        }}
      />

      {error ? (
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Alert type="error" showIcon message="模型列表加载失败" description={error.message} />
        </Card>
      ) : (
        <ProTable
          schema={filterSchema}
          columns={tableColumns}
          dataSource={list as unknown as ModelRecord[]}
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
          addButtonText="新增模型"
          onAdd={() => navigate(buildModelNewPath())}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: schemaQueryKeys.all });
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
                      message.success("模型删除成功");
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
