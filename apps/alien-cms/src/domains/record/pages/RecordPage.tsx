import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Flex, Popconfirm, Space, Spin, Typography } from "antd";
import { useRef } from "react";
import { SchemaFilter, SchemaTable } from "@alien-form/shared";
import { map as recordSchemaHandlers } from "../../../components/handlers";
import RecordFormFrame from "../components/RecordFormFrame";
import { useRecordStore } from "../hooks/use-record-store";
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
  const { message: messageApi } = App.useApp();
  const page = useRecordStore(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const singularLabel = page.schema?.["x-model"]?.singularLabel ?? "记录";

  // Keep last valid mode/openMode so Modal/Drawer can show correctly during close animation
  const lastModeRef = useRef<"add" | "edit" | "detail">("add");
  const lastOpenModeRef = useRef<"modal" | "drawer">("drawer");
  const lastRecordIdRef = useRef("new");

  if (page.actionMode !== "closed" && page.actionOpenMode && page.actionOpenMode !== "page") {
    lastModeRef.current = page.actionMode;
    lastOpenModeRef.current = page.actionOpenMode;
    lastRecordIdRef.current = page.activeRecordId ?? "new";
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
        <SchemaFilter
          projection={{
            schema: page.filterSchema,
            defaultVisibleKeys: page.filterDefaultVisibleKeys,
          }}
          initialValues={page.filterInitialValues}
          handlers={recordSchemaHandlers}
          loading={page.listLoading}
          actions={{ onSearch: page.setFilters }}
        />
      </Card>

      <SchemaTable
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
                  field: Array.isArray(single.field)
                    ? single.field.join(".")
                    : String(single.field),
                  order: single.order ?? undefined,
                }
              : undefined,
          );
        }}
        actions={{
          onAdd: page.openAdd,
          addText: `新增${singularLabel}`,
          onRefresh: page.refresh,
        }}
        detailHandlers={recordSchemaHandlers}
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
                onClick={() => page.openDetail(String(record.id))}
              >
                详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => page.openEdit(String(record.id))}
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
                  await page.removeRecord(String(record.id));
                  messageApi.success("删除成功");
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
        formKey={`${modelName}:${lastModeRef.current}:${lastRecordIdRef.current}`}
        singularLabel={singularLabel}
        schema={page.actionSchema ?? page.schema}
        initialValues={page.activeRecord}
        loading={page.detailLoading}
        submitting={page.submitting}
        onClose={page.closeAction}
        onSubmitAdd={async (values) => {
          await page.submitAdd(values);
          messageApi.success("新增成功");
        }}
        onSubmitEdit={async (values) => {
          await page.submitEdit(values);
          messageApi.success("保存成功");
        }}
      />
    </Flex>
  );
}
