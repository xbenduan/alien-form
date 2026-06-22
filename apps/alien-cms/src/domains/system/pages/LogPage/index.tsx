import { useMemo, useState } from "react";
import { Button, Card, Col, Descriptions, Drawer, Empty, Flex, Row, Select, Tag, Typography } from "antd";

import { useQuery } from "@tanstack/react-query";
import { getCurrentProviderSnapshot, createProviders } from "@alien-form/cms";
import type { LogEntry, LogListParams } from "@alien-form/cms";
import type { AlienCmsConfig } from "@alien-form/cms";

import { SchemaFilterBody } from "../../../../shared/schema-filter-scene";
import { ProTable } from "../../../../shared/components/ProTable";
import type { ModelRecord } from "../../../record/types/record";
import {
  ACTION_LABELS,
  filterDefaultVisibleKeys,
  filterSchema,
  tableColumns,
} from "./schema";

function useLogList(params: LogListParams) {
  return useQuery({
    queryKey: ["logs", params],
    queryFn: async () => {
      const snapshot = getCurrentProviderSnapshot();
      if (!snapshot || snapshot.type !== "http") {
        return { list: [], total: 0 };
      }
      const providers = createProviders(snapshot.config as AlienCmsConfig);
      return providers.logProvider.list(params);
    },
    placeholderData: (prev) => prev,
  });
}

function formatTimestamp(val: string | undefined): string {
  if (!val) return "-";
  const d = new Date(val);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LogPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filterModel, setFilterModel] = useState<string | undefined>(undefined);
  const [filterAction, setFilterAction] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>(undefined);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);

  const queryParams: LogListParams = useMemo(
    () => ({
      pagination,
      modelName: filterModel,
      action: filterAction as LogListParams["action"],
      dateRange,
    }),
    [pagination, filterModel, filterAction, dateRange],
  );

  const { data, isLoading, refetch } = useLogList(queryParams);

  const filterInitialValues = useMemo<Record<string, unknown>>(
    () => ({
      action: filterAction,
      modelName: filterModel,
      dateStart: dateRange?.start,
      dateEnd: dateRange?.end,
    }),
    [filterAction, filterModel, dateRange],
  );

  const snapshot = getCurrentProviderSnapshot();
  const isConnected = snapshot?.type === "http";

  if (!isConnected) {
    return (
      <Flex vertical gap={16}>
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Row gutter={[20, 20]} align="top" className="model-toolbar-row">
            <Col flex="auto">
              <Select disabled placeholder="操作类型" style={{ width: 140 }} />
            </Col>
          </Row>
        </Card>
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Empty description="请先连接远程服务后查看日志" />
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Card className="model-query-card" styles={{ body: { padding: 16 } }}>
        <SchemaFilterBody
          schema={filterSchema}
          initialValues={filterInitialValues}
          loading={isLoading}
          defaultVisibleKeys={filterDefaultVisibleKeys}
          onSearch={(values) => {
            const action = (values.action as string | undefined) || undefined;
            const modelName = (values.modelName as string | undefined) || undefined;
            const start = values.dateStart as string | undefined;
            const end = values.dateEnd as string | undefined;
            setFilterAction(action);
            setFilterModel(modelName);
            if (start && end) {
              setDateRange({
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
              });
            } else {
              setDateRange(undefined);
            }
            setPagination((p) => ({ ...p, current: 1 }));
          }}
        />
      </Card>

      <ProTable
        schema={filterSchema}
        columns={tableColumns}
        dataSource={(data?.list ?? []) as unknown as ModelRecord[]}
        loading={isLoading}
        total={data?.total ?? 0}
        rowKey="id"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
        }}
        onChange={(nextPagination) => {
          setPagination({
            current: nextPagination.current ?? 1,
            pageSize: nextPagination.pageSize ?? pagination.pageSize,
          });
        }}
        onRefresh={() => {
          refetch();
        }}
        actionsColumn={{
          title: "操作",
          key: "actions",
          width: 80,
          fixed: "right",
          render: (_, record) => (
            <Button
              type="link"
              size="small"
              onClick={() => setDetailEntry(record as unknown as LogEntry)}
            >
              详情
            </Button>
          ),
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="日志详情"
        open={Boolean(detailEntry)}
        onClose={() => setDetailEntry(null)}
        width={520}
      >
        {detailEntry ? (
          <Flex vertical gap={20}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="时间">
                {formatTimestamp(detailEntry.timestamp)}
              </Descriptions.Item>
              <Descriptions.Item label="操作类型">
                {(() => {
                  const meta = ACTION_LABELS[detailEntry.action];
                  return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{detailEntry.action}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="模型">
                {detailEntry.modelName}
              </Descriptions.Item>
              <Descriptions.Item label="记录 ID">
                {detailEntry.recordId || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="操作者">
                {detailEntry.operator || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="摘要">
                {detailEntry.summary || "-"}
              </Descriptions.Item>
            </Descriptions>

            {detailEntry.changes ? (
              <div>
                <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                  变更详情
                </Typography.Text>
                <pre style={{
                  padding: 12,
                  background: "#f8faff",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflow: "auto",
                  maxHeight: 400,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}>
                  {JSON.stringify(detailEntry.changes, null, 2)}
                </pre>
              </div>
            ) : null}
          </Flex>
        ) : null}
      </Drawer>
    </Flex>
  );
}
