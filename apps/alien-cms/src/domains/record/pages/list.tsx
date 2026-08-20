import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { App, Button, Card, Flex, Popconfirm, Space, Typography } from "antd";
import type { TableRowSelection } from "antd/es/table/interface";
import { FilterForm, Table } from "@alien-form/shared";
import type { Pagination, Sorter } from "../../../services";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { handles } from "../../../handles";
import { useRecordPage } from "../hooks";
import { RecordActionOverlay } from "../components";
import styles from "./index.module.css";

/** 记录列表页：filter + table，行内操作跳转 add/edit/detail。 */
export default function RecordListPage() {
  const { modelName = "" } = useParams();
  const { message } = App.useApp();
  const page = useRecordPage(modelName);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  if (page.schemaLoading) return <PageLoading />;
  if (page.schemaError || !page.schema || !page.displaySchema) {
    return <PageError title="模型不存在或加载失败" description={page.schemaError?.message} />;
  }

  const { singularLabel } = page.schema.meta;

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: page.schema.meta.title }]} />
      <Card styles={{ body: { padding: 16 } }}>
        <FilterForm
          schema={page.displaySchema}
          handlers={handles}
          loading={page.listLoading}
          onSearch={page.setFilters}
        />
      </Card>

      <div className={`${styles.listPage} ${styles.tableCard}`}>
        <div className={styles.toolbar}>
          {selectedRowKeys.length > 0 ? (
            <Space>
              <Typography.Text type="secondary">
                {`已选择 ${selectedRowKeys.length} 条`}
              </Typography.Text>
              <Popconfirm
                title={`确认删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                disabled={selectedRowKeys.length === 0}
                onConfirm={async () => {
                  await page.removeRecords(selectedRowKeys.map(String));
                  setSelectedRowKeys([]);
                  message.success("批量删除成功");
                }}
              >
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
                  批量删除
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Typography.Text type="secondary">批量操作</Typography.Text>
          )}
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => page.refresh()} aria-label="刷新" />
            <Button type="primary" icon={<PlusOutlined />} onClick={page.openAdd}>
              新增{singularLabel}
            </Button>
          </Space>
        </div>
        <Table
          schema={page.displaySchema}
          dataSource={page.records}
          loading={page.listLoading || page.deleting}
          total={page.total}
          pagination={{ current: page.pagination.current, pageSize: page.pagination.pageSize }}
          rowSelection={
            {
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            } satisfies TableRowSelection<Record<string, unknown>>
          }
          onChange={(nextPagination, _filters, nextSorter) => {
            page.setPagination({
              current: nextPagination.current ?? 1,
              pageSize: nextPagination.pageSize ?? page.pagination.pageSize,
            } satisfies Pagination);
            const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
            page.setSorter(
              single?.field && single.order
                ? ({
                    field: Array.isArray(single.field)
                      ? single.field.join(".")
                      : String(single.field),
                    order: single.order,
                  } satisfies Sorter)
                : undefined,
            );
          }}
          actionColumn={{
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
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    await page.removeRecord(String(record.id));
                    setSelectedRowKeys((keys) =>
                      keys.filter((key) => String(key) !== String(record.id)),
                    );
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
      </div>

      <RecordActionOverlay
        modelName={modelName}
        schema={page.schema}
        overlay={page.overlay}
        submitting={page.submitting}
        onClose={page.closeOverlay}
        createRecord={page.createRecord}
        updateRecord={page.updateRecord}
      />
    </Flex>
  );
}
