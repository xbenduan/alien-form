import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card, Col, Row, message } from 'antd';
import { useModelPage } from '../../hooks/use-model-page';
import type { ModelRouteState, ModelSummary } from '../../types/model';
import { ModelActionHost } from './ModelActionDrawer';
import { ModelFilterBar } from './ModelFilterBar';
import { ModelPageHeader } from './ModelPageHeader';
import { ModelTable } from './ModelTable';

interface ModelPageProps {
  modelName: string;
  modelSummaries: ModelSummary[];
  currentPath: string;
  routeAction: ModelRouteState;
  onNavigateModel: (modelName: string) => void;
  onRouteActionChange: (nextAction: ModelRouteState) => void;
}

export default function ModelPage({
  modelName,
  modelSummaries,
  currentPath,
  routeAction,
  onNavigateModel,
  onRouteActionChange,
}: ModelPageProps) {
  const page = useModelPage(modelName, {
    routeAction,
    onRouteActionChange,
  });
  const singularLabel = page.schema['x-model']?.singularLabel ?? '记录';
  const modelTitle = page.schema['x-model']?.title ?? '模型工作台';
  const isStandaloneActionPage = page.actionMode !== 'closed' && page.actionOpenMode === 'page';
  const currentActionLabel =
    page.actionMode === 'add'
      ? `新增${singularLabel}`
      : page.actionMode === 'edit'
        ? `编辑${singularLabel}`
        : page.actionMode === 'detail'
          ? `${singularLabel}详情`
          : '列表';

  return (
    <div className="model-page-shell">
      <div className="model-workbench-layout">
        <aside className="model-workbench-sidebar">
          <ModelPageHeader
            title={modelTitle}
            subtitle={page.schema['x-model']?.subtitle}
            description={page.schema['x-model']?.description}
            currentPath={currentPath}
            modelSummaries={modelSummaries}
            activeModel={modelName}
            onNavigateModel={onNavigateModel}
          />
        </aside>

        <section className="model-workbench-main">
          <div className="model-breadcrumb-bar">
            <div className="model-breadcrumb-content">
              <Breadcrumb
                items={[
                  { title: '模型管理' },
                  { title: modelTitle },
                  { title: currentActionLabel },
                ]}
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
                    <ModelFilterBar
                      fields={page.filterFields}
                      values={page.filters}
                      loading={page.listLoading}
                      onSearch={page.setFilters}
                    />
                  </Col>
                  <Col flex="220px">
                    <div className="model-toolbar-actions">
                      <Button
                        type="primary"
                        size="large"
                        className="model-add-button"
                        icon={<PlusOutlined />}
                        onClick={page.openAdd}
                      >
                        新增{singularLabel}
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card>

              <div className="model-table-section">
                <ModelTable
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
                    message.success('删除成功');
                  }}
                />
              </div>
            </>
          )}

          <ModelActionHost
            mode={page.actionMode}
            openMode={page.actionOpenMode ?? 'drawer'}
            singularLabel={singularLabel}
            addSchema={page.addSchema}
            editSchema={page.editSchema}
            detailSchema={page.detailSchema}
            record={page.activeRecord}
            loading={page.detailLoading}
            submitting={page.submitting}
            onClose={page.closeAction}
            onSubmitAdd={async (values) => {
              await page.submitAdd(values);
              message.success('新增成功');
            }}
            onSubmitEdit={async (values) => {
              await page.submitEdit(values);
              message.success('保存成功');
            }}
          />
        </section>
      </div>
    </div>
  );
}
