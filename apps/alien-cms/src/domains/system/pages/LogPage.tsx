import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Descriptions, Drawer, Empty, Flex, Row, Select, DatePicker, Table, Tag, Typography } from "antd";

import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import { getCurrentProviderSnapshot, createProviders } from "@alien-form/cms";
import type { LogEntry, LogListParams } from "@alien-form/cms";
import type { AlienCmsConfig } from "@alien-form/cms";

const { RangePicker } = DatePicker;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "schema.create": { label: "创建模型", color: "blue" },
  "schema.update": { label: "更新模型", color: "cyan" },
  "schema.delete": { label: "删除模型", color: "red" },
  "record.create": { label: "创建记录", color: "green" },
  "record.update": { label: "更新记录", color: "orange" },
  "record.delete": { label: "删除记录", color: "volcano" },
  "record.batchDelete": { label: "批量删除", color: "magenta" },
};

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, { label }]) => ({
  value,
  label,
}));

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
  const { setBreadcrumb } = useWorkbenchLayout();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filterModel, setFilterModel] = useState<string | undefined>(undefined);
  const [filterAction, setFilterAction] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>(undefined);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);

  useEffect(() => {
    setBreadcrumb({
      items: [{ title: "系统设置" }, { title: "操作日志" }],
    });
    return () => setBreadcrumb(null);
  }, [setBreadcrumb]);

  const queryParams: LogListParams = useMemo(
    () => ({
      pagination,
      modelName: filterModel,
      action: filterAction as LogListParams["action"],
      dateRange,
    }),
    [pagination, filterModel, filterAction, dateRange],
  );

  const { data, isLoading } = useLogList(queryParams);

  const columns: ColumnsType<LogEntry> = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "timestamp",
        key: "timestamp",
        width: 180,
        render: (val: string) => formatTimestamp(val),
      },
      {
        title: "操作类型",
        dataIndex: "action",
        key: "action",
        width: 120,
        render: (val: string) => {
          const meta = ACTION_LABELS[val];
          return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{val}</Tag>;
        },
      },
      {
        title: "模型",
        dataIndex: "modelName",
        key: "modelName",
        width: 140,
        ellipsis: true,
      },
      {
        title: "记录 ID",
        dataIndex: "recordId",
        key: "recordId",
        width: 200,
        ellipsis: true,
        render: (val: string) => val || "-",
      },
      {
        title: "摘要",
        dataIndex: "summary",
        key: "summary",
        ellipsis: true,
        render: (val: string) => val || "-",
      },
      {
        title: "操作",
        key: "actions",
        width: 80,
        render: (_, record) => (
          <Button
            type="link"
            size="small"

            onClick={() => setDetailEntry(record)}
          >
            详情
          </Button>
        ),
      },
    ],
    [],
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
      {/* 筛选工具栏 */}
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Row gutter={[20, 20]} align="top" className="model-toolbar-row">
          <Col flex="140px">
            <Select
              allowClear
              placeholder="操作类型"
              style={{ width: "100%" }}
              options={ACTION_OPTIONS}
              value={filterAction}
              onChange={(val) => {
                setFilterAction(val);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            />
          </Col>
          <Col flex="160px">
            <Select
              allowClear
              placeholder="模型名称"
              style={{ width: "100%" }}
              showSearch
              value={filterModel}
              onChange={(val) => {
                setFilterModel(val);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              options={
                (data?.list ?? [])
                  .map((item) => item.modelName)
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .map((name) => ({ value: name, label: name }))
              }
            />
          </Col>
          <Col flex="320px">
            <RangePicker
              showTime
              style={{ width: "100%" }}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange({
                    start: dates[0].toISOString(),
                    end: dates[1].toISOString(),
                  });
                } else {
                  setDateRange(undefined);
                }
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Table<LogEntry>
        rowKey="id"
        className="model-data-table"
        columns={columns}
        dataSource={data?.list ?? []}
        loading={isLoading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={(pag) => {
          setPagination({
            current: pag.current ?? 1,
            pageSize: pag.pageSize ?? 20,
          });
        }}
        scroll={{ x: 900 }}
        size="middle"
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
