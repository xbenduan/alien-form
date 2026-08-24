import { Card, Space } from "antd";
import { Table } from "@alien-form/shared";
import type { AfUiNode, ModelRecord, PageContext, Sorter } from "../../../runtime";
import { RenderNode } from "../../../runtime";
import { pageOf, layoutCtx, type TableContext } from "./types";
import styles from "../ui.module.css";
import { useState } from "react";
import { Typography } from "antd";

export function TableLayout({
  children,
  slots = {},
  ctx,
}: {
  children: AfUiNode[];
  slots?: Record<string, AfUiNode[]>;
  ctx: PageContext;
}) {
  const page = pageOf(ctx);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const rowActions = children.find((node) => node.component === "row-actions");
  const batchActions = slots.toolbarLeft ?? [];
  const utilityActions = slots.toolbarRight ?? [];
  const table: TableContext = { selectedRowKeys, setSelectedRowKeys };
  const childContext = layoutCtx(ctx, table);

  return (
    <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
      <Table
        columns={page.compiled?.columns ?? []}
        dataSource={page.records}
        loading={page.listLoading || page.deleting}
        total={page.total}
        pagination={{ current: page.pagination.current, pageSize: page.pagination.pageSize }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        toolbar={
          <div className={styles.tableToolbar}>
            <Space wrap>
              {selectedRowKeys.length ? (
                <>
                  {batchActions.map((node, index) => (
                    <RenderNode key={`${node.component}-${index}`} node={node} ctx={childContext} />
                  ))}
                  <Typography.Text type="secondary">
                    已选择 {selectedRowKeys.length} 条
                  </Typography.Text>
                </>
              ) : (
                <Typography.Text type="secondary">批量操作</Typography.Text>
              )}
            </Space>
            <Space>
              {utilityActions.map((node, index) => (
                <RenderNode key={`${node.component}-${index}`} node={node} ctx={childContext} />
              ))}
            </Space>
          </div>
        }
        actionColumn={
          rowActions
            ? {
                title: "操作",
                key: "actions",
                fixed: "right",
                width: 180,
                render: (_, record) => (
                  <Space size={4} wrap>
                    {rowActions.children?.map((node, index) => (
                      <RenderNode
                        key={`${node.component}-${index}`}
                        node={node}
                        ctx={layoutCtx(ctx, { ...table, row: record as ModelRecord })}
                      />
                    ))}
                  </Space>
                ),
              }
            : undefined
        }
        onChange={(nextPagination, _filters, nextSorter) => {
          page.setPagination({
            current: nextPagination.current ?? 1,
            pageSize: nextPagination.pageSize ?? page.pagination.pageSize,
          });
          const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
          page.setSorter(
            single?.field && single.order
              ? {
                  field: Array.isArray(single.field)
                    ? single.field.join(".")
                    : String(single.field),
                  order: single.order as Sorter["order"],
                }
              : undefined,
          );
        }}
      />
    </Card>
  );
}
