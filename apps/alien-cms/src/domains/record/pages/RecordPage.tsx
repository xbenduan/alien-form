import { Alert, Card, Col, Flex, Row, Spin, message } from "antd";
import { useEffect, useRef } from "react";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import { useRecordStore } from "../../../hooks/use-record-store";
import type { RecordRouteState } from "../types/record";
import { RecordFilterBar } from "../components/RecordFilterBar";
import RecordFormFrame from "../components/RecordFormFrame";
import { RecordToolbarActions } from "../components/RecordToolbarActions";
import { RecordTable } from "../components/RecordTable";

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
  const { setBreadcrumb } = useWorkbenchLayout();
  const page = useRecordStore(modelName, {
    routeAction,
    onRouteActionChange,
  });
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

  useEffect(() => {
    setBreadcrumb({
      items: [
        { title: "模型管理" },
        { title: page.schema?.["x-model"]?.title ?? modelName },
        {
          title: page.schemaLoading
            ? "加载中"
            : page.schemaError || !page.schema || !page.filterSchema
              ? "未找到模型"
              : "列表",
        },
      ],
    });

    return () => setBreadcrumb(null);
  }, [
    modelName,
    page.filterSchema,
    page.schema,
    page.schemaError,
    page.schemaLoading,
    setBreadcrumb,
  ]);

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
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Row gutter={[20, 20]} align="top" wrap={false} className="model-toolbar-row">
          <Col flex="auto">
            <RecordFilterBar
              schema={page.filterSchema}
              defaultVisibleKeys={page.filterDefaultVisibleKeys}
              values={page.filterInitialValues}
              loading={page.listLoading}
              onSearch={page.setFilters}
            />
          </Col>
          <Col flex="220px">
            <RecordToolbarActions
              singularLabel={singularLabel}
              tableFieldOptions={page.tableFieldOptions}
              tableVisibleKeys={page.tableVisibleKeys}
              onOpenAdd={page.openAdd}
              onChangeTableVisibleKeys={page.setTableVisibleKeys}
              onResetTableVisibleKeys={page.resetTableVisibleKeys}
            />
          </Col>
        </Row>
      </Card>

      <RecordTable
        columns={page.tableColumns}
        records={page.records}
        total={page.total}
        loading={page.listLoading || page.deleting}
        pagination={page.pagination}
        sorter={page.sorter}
        onTableChange={({ pagination, sorter }) => {
          page.setPagination({
            current: pagination.current ?? 1,
            pageSize: pagination.pageSize ?? page.pagination.pageSize,
          });
          page.setSorter(
            sorter?.field
              ? {
                  field: String(sorter.field),
                  order: sorter.order ?? undefined,
                }
              : undefined,
          );
        }}
        onDetail={page.openDetail}
        onEdit={page.openEdit}
        onDelete={async (id) => {
          await page.removeRecord(id);
          message.success("删除成功");
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
