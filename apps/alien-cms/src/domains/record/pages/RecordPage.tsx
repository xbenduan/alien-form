import { ArrowLeftOutlined, SettingOutlined } from "@ant-design/icons";
import { Alert, Breadcrumb, Button, Card, Col, Row, Spin, Tooltip, message } from "antd";
import { useNavigate } from "react-router-dom";
import { buildModelEditPath } from "../../../app/router/paths";
import { useRecordPage } from "../hooks/use-record-page";
import type { RecordRouteState } from "../types/record";
import { RecordActionHost } from "../components/RecordActionHost";
import { RecordFilterBar } from "../components/RecordFilterBar";
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
  const navigate = useNavigate();
  const page = useRecordPage(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const singularLabel = page.schema?.["x-model"]?.singularLabel ?? "记录";
  const modelTitle = page.schema?.["x-model"]?.title ?? "模型工作台";
  const isStandaloneActionPage = page.actionMode !== "closed" && page.actionOpenMode === "page";
  const currentActionLabel =
    page.actionMode === "add"
      ? `新增${singularLabel}`
      : page.actionMode === "edit"
        ? `编辑${singularLabel}`
        : page.actionMode === "detail"
          ? `${singularLabel}详情`
          : "列表";

  if (page.schemaLoading) {
    return (
      <>
        <div className="model-breadcrumb-bar">
          <div className="model-breadcrumb-content">
            <Breadcrumb
              items={[{ title: "模型管理" }, { title: modelName }, { title: "加载中" }]}
            />
          </div>
        </div>

        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <div className="model-page-loading">
            <Spin size="large" />
          </div>
        </Card>
      </>
    );
  }

  if (page.schemaError || !page.schema || !page.filterSchema) {
    return (
      <>
        <div className="model-breadcrumb-bar">
          <div className="model-breadcrumb-content">
            <Breadcrumb
              items={[{ title: "模型管理" }, { title: modelName }, { title: "未找到模型" }]}
            />
          </div>
        </div>

        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Alert
            type="error"
            showIcon
            message="模型不存在或加载失败"
            description={page.schemaError?.message}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="model-breadcrumb-bar">
        <div className="model-breadcrumb-content">
          <Breadcrumb
            items={[{ title: "模型管理" }, { title: modelTitle }, { title: currentActionLabel }]}
          />
          {isStandaloneActionPage ? (
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={page.closeAction}>
              返回列表
            </Button>
          ) : null}
        </div>
      </div>

      {isStandaloneActionPage ? null : (
        <>
          <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
            <Row gutter={[20, 20]} align="top" wrap={false} className="model-toolbar-row">
              <Col flex="auto">
                <RecordFilterBar
                  schema={page.filterSchema}
                  defaultVisibleKeys={page.filterDefaultVisibleKeys}
                  values={page.filters}
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

          <div className="model-table-section">
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
          </div>
        </>
      )}

      <RecordActionHost
        mode={page.actionMode}
        openMode={page.actionOpenMode ?? "drawer"}
        singularLabel={singularLabel}
        schema={page.schema}
        record={page.activeRecord}
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
    </>
  );
}
