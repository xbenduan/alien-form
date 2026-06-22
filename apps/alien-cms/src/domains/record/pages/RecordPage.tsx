import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Flex, Popconfirm, Space, Spin, Typography, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { recordQueryKeys, useRecordStore } from "../../../hooks/use-record-store";
import { SchemaFilterBody } from "../../../shared/schema-filter-scene";
import { ProTable } from "../../../shared/components/ProTable";
import RecordFormFrame from "../components/RecordFormFrame";
import type { RecordRouteState } from "../types/record";

interface RecordPageProps {
  modelName: string;
  routeAction: RecordRouteState;
  onRouteActionChange: (nextAction: RecordRouteState) => void;
}

export default function RecordPage({
  modelName,
  routeAction,
  onRouteActionChange,
}: RecordPageProps) {
  const page = useRecordStore(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const queryClient = useQueryClient();
  const singularLabel = page.schema?.["x-model"]?.singularLabel ?? "记录";

  // Keep last valid mode/openMode so Modal/Drawer can show correctly during close animation
  const lastModeRef = useRef<"add" | "edit" | "detail">("add");
  const lastOpenModeRef = useRef<"modal" | "drawer">("drawer");

  if (page.actionMode !== "closed" && page.actionOpenMode && page.actionOpenMode !== "page") {
    lastModeRef.current = page.actionMode;
    lastOpenModeRef.current = page.actionOpenMode;
  }

  const isFormOpen =
    page.actionMode !== "closed" && page.actionOpenMode != null && page.actionOpenMode !== "page";

  if (page.schemaLoading) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <div className="model-page-loading">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (page.schemaError || !page.schema || !page.filterSchema) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Alert
          type="error"
          showIcon
          message="模型不存在或加载失败"
          description={page.schemaError?.message}
        />
      </Card>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Card className="model-query-card" styles={{ body: { padding: 16 } }}>
        <SchemaFilterBody
          schema={page.filterSchema}
          initialValues={page.filterInitialValues}
          loading={page.listLoading}
          defaultVisibleKeys={page.filterDefaultVisibleKeys}
          onSearch={page.setFilters}
        />
      </Card>

      <ProTable
        schema={page.schema}
        columns={page.tableColumns}
        dataSource={page.records}
        loading={page.listLoading || page.deleting}
        total={page.total}
        sorter={page.sorter}
        rowKey="id"
        pagination={{
          current: page.pagination.current,
          pageSize: page.pagination.pageSize,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
        }}
        onChange={(nextPagination, _filters, nextSorter) => {
          page.setPagination({
            current: nextPagination.current ?? 1,
            pageSize: nextPagination.pageSize ?? page.pagination.pageSize,
          });
          const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
          page.setSorter(
            single?.field
              ? {
                  field: Array.isArray(single.field) ? single.field.join(".") : String(single.field),
                  order: single.order ?? undefined,
                }
              : undefined,
          );
        }}
        onAdd={page.openAdd}
        addButtonText={`新增${singularLabel}`}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) });
        }}
        columnSetting={{
          options: page.tableFieldOptions,
          values: page.tableVisibleKeys,
          onChange: page.setTableVisibleKeys,
          onReset: page.resetTableVisibleKeys,
        }}
        actionsColumn={{
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
                onClick={() => page.openDetail(record.id)}
              >
                详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => page.openEdit(record.id)}
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
                onConfirm={async () => {
                  await page.removeRecord(record.id);
                  message.success("删除成功");
                }}
              >
                <Button danger type="link" size="small" icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          ),
        }}
      />

      <RecordFormFrame
        open={isFormOpen}
        openMode={lastOpenModeRef.current}
        mode={lastModeRef.current}
        singularLabel={singularLabel}
        schema={page.schema}
        initialValues={page.activeRecord}
        loading={page.detailLoading}
        submitting={page.submitting}
        onClose={page.closeAction}
        onSubmitAdd={async (values) => {
          await page.submitAdd(values);
          message.success("新增成功");
        }}
        onSubmitEdit={async (values) => {
          await page.submitEdit(values);
          message.success("保存成功");
        }}
      />
    </Flex>
  );
}
