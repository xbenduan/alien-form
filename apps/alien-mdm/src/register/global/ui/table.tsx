import { Card, Space } from "antd";
import {
  useListBlock,
  useRuntime,
  RenderNode,
  type ComponentProps,
} from "@alien-form/engine/react";
import { Table } from "@components/Table";
import type { TableColumnAction } from "@components/Table";
import type { TableColumn } from "../../../types/shared";
import { useEffect, useState } from "react";
import type { ModelRecord } from "../../../runtime/types";
import { RowContext, TableContext, type TableContextValue } from "./table-context";
import styles from "../ui.module.css";

export function TableLayout({ node }: ComponentProps) {
  const runtime = useRuntime();
  const list = useListBlock(node.block ?? "main");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const columns = (node.props?.columns as TableColumn[]) ?? [];
  const data = list.data as ModelRecord[];

  const model = node.props?.model as string | undefined;

  // 叠加层提交（新增/编辑）后刷新列表。
  useEffect(() => {
    return runtime.bus.on("record:changed", () => list.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  const handleDelete = async (id: string) => {
    if (!model) return;
    const svc = runtime.registry.services.resolve("records.delete");
    if (svc) {
      await svc.send({ model, id });
      list.refresh();
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    if (!model) return;
    const svc = runtime.registry.services.resolve("records.deleteMany");
    if (svc) {
      await svc.send({ model, ids });
      setSelectedRowKeys([]);
      list.refresh();
    }
  };

  const tableCtx: TableContextValue = {
    selectedRowKeys,
    setSelectedRowKeys,
    onDelete: handleDelete,
    onBatchDelete: handleBatchDelete,
  };

  const rowActions = node.children?.find((n) => n.component === "row-actions");
  const batchActions = node.slots?.toolbarLeft ?? [];
  const utilityActions = node.slots?.toolbarRight ?? [];

  const actionColumn = rowActions
    ? ({
        title: "操作",
        key: "actions",
        fixed: "right" as const,
        width: 180,
        render: (_: unknown, record: ModelRecord) => (
          <RowContext.Provider value={record as ModelRecord}>
            <Space size={4} wrap>
              {rowActions.children?.map((child, i) => (
                <RenderNode key={i} node={child} />
              ))}
            </Space>
          </RowContext.Provider>
        ),
      } as unknown as TableColumnAction)
    : undefined;

  return (
    <TableContext.Provider value={tableCtx}>
      <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          actionColumn={actionColumn}
          dataSource={data}
          loading={list.loading}
          total={list.total}
          pagination={{
            current: list.pagination.current,
            pageSize: list.pagination.pageSize,
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          toolbar={
            <div className={styles.tableToolbar}>
              <Space wrap>
                {selectedRowKeys.length
                  ? batchActions.map((n, i) => <RenderNode key={i} node={n} />)
                  : null}
                {selectedRowKeys.length ? (
                  <span>已选择 {selectedRowKeys.length} 条</span>
                ) : (
                  <span>批量操作</span>
                )}
              </Space>
              <Space>
                {utilityActions.map((n, i) => (
                  <RenderNode key={i} node={n} />
                ))}
              </Space>
            </div>
          }
          onChange={(nextPagination, _filters, nextSorter) => {
            list.setPagination({
              current: nextPagination.current ?? 1,
              pageSize: nextPagination.pageSize ?? list.pagination.pageSize,
            });
            const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
            list.setSorter(
              single?.field && single.order
                ? {
                    field: Array.isArray(single.field)
                      ? single.field.join(".")
                      : String(single.field),
                    order: single.order === "ascend" ? "asc" : "desc",
                  }
                : undefined,
            );
          }}
        />
      </Card>
    </TableContext.Provider>
  );
}
