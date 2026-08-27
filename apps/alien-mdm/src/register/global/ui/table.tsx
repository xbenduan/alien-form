import { Card, Space } from "antd";
import {
  useListBlock,
  useRuntime,
  RenderNode,
  type ComponentProps,
} from "@alien-form/engine/react";
import { Table } from "@components/table";
import type { TableColumnAction } from "@components/table";
import type { TableColumn } from "@app-types/shared";
import { useEffect, useState } from "react";
import type { ModelRecord } from "@runtime/types";
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

  const rowActions = node.children?.find((n) => n.component === "row-actions");
  const batchAction = node.slots?.toolbarLeft;
  const utilityAction = node.slots?.toolbarRight;

  const actionColumn = rowActions
    ? ({
        title: "操作",
        key: "actions",
        fixed: "right" as const,
        width: 180,
        render: (_: unknown, record: ModelRecord) => (
          <Space size={4} wrap>
            {rowActions.children?.map((child, i) => (
              <RenderNode key={i} node={child} props={{ record, onDelete: handleDelete }} />
            ))}
          </Space>
        ),
      } as unknown as TableColumnAction)
    : undefined;

  return (
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
                ? batchAction && (
                    <RenderNode
                      node={batchAction}
                      props={{ selectedRowKeys, onBatchDelete: handleBatchDelete }}
                    />
                  )
                : null}
              {selectedRowKeys.length ? (
                <span>已选择 {selectedRowKeys.length} 条</span>
              ) : (
                <span>批量操作</span>
              )}
            </Space>
            <Space>{utilityAction ? <RenderNode node={utilityAction} /> : null}</Space>
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
  );
}
