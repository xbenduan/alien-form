import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, message } from 'antd';
import { useModelPage } from '../../hooks/use-model-page';
import type { ModelSummary } from '../../types/model';
import { ModelActionDrawer } from './ModelActionDrawer';
import { ModelFilterBar } from './ModelFilterBar';
import { ModelPageHeader } from './ModelPageHeader';
import { ModelTable } from './ModelTable';

interface ModelPageProps {
  modelName: string;
  modelSummaries: ModelSummary[];
  currentPath: string;
  onNavigateModel: (modelName: string) => void;
}

export default function ModelPage({
  modelName,
  modelSummaries,
  currentPath,
  onNavigateModel,
}: ModelPageProps) {
  const page = useModelPage(modelName);
  const singularLabel = page.schema['x-model']?.singularLabel ?? '记录';

  return (
    <div className="model-page-shell">
      <ModelPageHeader
        title={page.schema['x-model']?.title ?? '模型工作台'}
        subtitle={page.schema['x-model']?.subtitle}
        description={page.schema['x-model']?.description}
        currentPath={currentPath}
        modelSummaries={modelSummaries}
        activeModel={modelName}
        onNavigateModel={onNavigateModel}
      />

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

      <ModelActionDrawer
        mode={page.drawerMode}
        singularLabel={singularLabel}
        addSchema={page.addSchema}
        editSchema={page.editSchema}
        detailItems={page.detailItems}
        record={page.activeRecord}
        loading={page.detailLoading}
        submitting={page.submitting}
        onClose={page.closeDrawer}
        onSubmitAdd={async (values) => {
          await page.submitAdd(values);
          message.success('新增成功');
        }}
        onSubmitEdit={async (values) => {
          await page.submitEdit(values);
          message.success('保存成功');
        }}
      />
    </div>
  );
}
