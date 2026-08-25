import { Card, Space } from "antd";
import { useSignalValue } from "@alien-form/react";
import { Table } from "@alien-form/shared";
import type { TableColumn } from "@alien-form/shared";
import type { AfUiNode, ModelRecord, PageContext, Sorter } from "../../../runtime";
import { RenderNode } from "../../../runtime";
import { layoutCtx, scopeOf, type TableContext } from "./types";
import { useRecordListQuery } from "../../../hooks";
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
  const scope = scopeOf(ctx);
  const filters = useSignalValue(scope.filters) as Record<string, unknown>;
  const pagination = useSignalValue(scope.pagination);
  const sorter = useSignalValue(scope.sorter) as Sorter | undefined;
  const refreshVersion = useSignalValue(scope.refreshVersion);

  const listQuery = useRecordListQuery(ctx, {
    filters,
    pagination,
    sorter,
    refreshVersion,
    enabled: true,
  });

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const rowActions = children.find((node) => node.component === "row-actions");
  const batchActions = slots.toolbarLeft ?? [];
  const utilityActions = slots.toolbarRight ?? [];
  const table: TableContext = { selectedRowKeys, setSelectedRowKeys };
  const childContext = layoutCtx(ctx, table);

  const columns = ((ctx.compiled as { columns?: TableColumn[] }).columns ?? []) as TableColumn[];
  const data = (listQuery.data?.list ?? []) as ModelRecord[];

  return (
    <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
      <Table
        columns={columns}
        dataSource={data}
        loading={listQuery.isFetching}
        total={listQuery.data?.total ?? 0}
        pagination={{ current: pagination.current, pageSize: pagination.pageSize }}
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
          scope.setPagination({
            current: nextPagination.current ?? 1,
            pageSize: nextPagination.pageSize ?? pagination.pageSize,
          });
          const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
          scope.setSorter(
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
