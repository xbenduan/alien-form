import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Layout as AntLayout,
  Popconfirm,
  Space,
  Spin,
  Table as AntTable,
  Tree as AntTree,
  type TableColumnsType,
} from "antd";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ComponentProps } from "@binding";
import type { FieldSchema } from "@engine";
import { transport } from "@runtime/transport";
import { recordRoute } from "@utils/record-route";

const GAP = 16;

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  const main = (
    <AntLayout.Content
      style={{
        display: "flex",
        flexDirection: "column",
        gap: GAP,
        minWidth: 0,
        background: "transparent",
      }}
    >
      {slots.rightTop}
      {slots.rightBottom}
      {children}
    </AntLayout.Content>
  );

  if (!slots.left) return main;
  return (
    <AntLayout
      hasSider
      style={{ gap: GAP, minHeight: 520, minWidth: 0, background: "transparent" }}
    >
      <AntLayout.Sider
        width={280}
        theme="light"
        style={{ minWidth: 240, background: "transparent" }}
      >
        {slots.left}
      </AntLayout.Sider>
      {main}
    </AntLayout>
  );
}

function parseFilter(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function Filter({ value, onChange, schema }: ComponentProps & { schema?: FieldSchema }) {
  const fields = Object.entries(schema?.properties ?? {}).filter(
    ([, field]) =>
      field["x-table"]?.filterable === true ||
      (field["x-database"] as { filterable?: boolean } | undefined)?.filterable === true,
  );
  const filter = parseFilter(value);
  const update = (key: string, next: string) => {
    const result = { ...filter, [key]: next || undefined };
    onChange?.(JSON.stringify(result));
  };
  return (
    <Card size="small">
      <Flex gap={12} wrap align="center">
        {fields.slice(0, 4).map(([key, field]) => (
          <Input
            key={key}
            allowClear
            prefix={<SearchOutlined />}
            placeholder={field.title ?? key}
            value={String(filter[key] ?? "")}
            onChange={(event) => update(key, event.target.value)}
            style={{ width: 220 }}
          />
        ))}
        <Button onClick={() => onChange?.("{}")}>重置</Button>
      </Flex>
    </Card>
  );
}

interface ListResult {
  list: Record<string, unknown>[];
  total: number;
}

export function Table({
  schema,
  columns,
  loadData,
  filter,
  nodeId,
  slots,
  rowKey = "id",
  modelCode,
}: ComponentProps & {
  schema?: FieldSchema;
  columns?:
    | TableColumnsType<Record<string, unknown>>
    | ((schema?: FieldSchema) => TableColumnsType<Record<string, unknown>>);
  loadData?: (params: Record<string, unknown>) => Promise<ListResult>;
  filter?: string;
  nodeId?: unknown;
  rowKey?: string;
  modelCode?: string;
}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { modelCode: routeModelCode } = useParams();
  const resolvedModelCode = modelCode ?? routeModelCode;
  const [data, setData] = useState<ListResult>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const resolvedColumns = useMemo(
    () => (typeof columns === "function" ? columns(schema) : columns) ?? [],
    [columns, schema],
  );
  const refresh = useCallback(async () => {
    if (!loadData) return;
    setLoading(true);
    try {
      setData(
        await loadData({
          filters: { ...parseFilter(filter), nodeId },
          pagination: { current: page, pageSize: 20 },
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [filter, loadData, nodeId, page]);
  const removeRecord = useCallback(
    async (recordId: unknown) => {
      if (!resolvedModelCode) return;
      setLoading(true);
      try {
        await transport.send(
          `/api/records/${encodeURIComponent(resolvedModelCode)}/${encodeURIComponent(String(recordId))}`,
          { method: "DELETE" },
        );
        message.success("记录已删除");
        await refresh();
      } catch (reason) {
        message.error(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setLoading(false);
      }
    },
    [message, refresh, resolvedModelCode],
  );
  const tableColumns = useMemo<TableColumnsType<Record<string, unknown>>>(() => {
    if (!resolvedModelCode) return resolvedColumns;
    return [
      ...resolvedColumns,
      {
        key: "$actions",
        title: "操作",
        width: 220,
        render: (_value, record) => {
          const recordId = record[rowKey];
          const hasRecordId = recordId !== undefined && recordId !== null && recordId !== "";
          const protectedAdmin =
            resolvedModelCode === "_sys_user" && String(recordId) === "_sys_admin";
          return (
            <Space size={0}>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                disabled={!hasRecordId}
                onClick={() => navigate(recordRoute(resolvedModelCode, "detail", recordId))}
              >
                详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                disabled={!hasRecordId}
                onClick={() => navigate(recordRoute(resolvedModelCode, "edit", recordId))}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认删除这条记录？"
                description="删除后无法恢复。"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                disabled={!hasRecordId || protectedAdmin}
                onConfirm={() => removeRecord(recordId)}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!hasRecordId || protectedAdmin}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ];
  }, [navigate, removeRecord, resolvedColumns, resolvedModelCode, rowKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          {resolvedModelCode && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(recordRoute(resolvedModelCode, "add"))}
            >
              新增
            </Button>
          )}
          {slots.toolbar}
        </Flex>
      }
      extra={
        <Button
          type="text"
          icon={<ReloadOutlined />}
          aria-label="刷新"
          onClick={() => void refresh()}
        />
      }
    >
      <AntTable
        rowKey={rowKey}
        columns={tableColumns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data.total,
          onChange: setPage,
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}

interface TreeItem {
  key: string;
  title: string;
  children?: TreeItem[];
}

export function Tree({
  value,
  onChange,
  loadData,
}: ComponentProps & { loadData?: () => Promise<TreeItem[]> }) {
  const [nodes, setNodes] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loadData) return;
    setLoading(true);
    void loadData()
      .then(setNodes)
      .finally(() => setLoading(false));
  }, [loadData]);
  return (
    <Card size="small">
      <Spin spinning={loading}>
        {nodes.length ? (
          <AntTree
            treeData={nodes}
            selectedKeys={value == null ? [] : [String(value)]}
            onSelect={(keys) => onChange?.(keys[0])}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分组" />
        )}
      </Spin>
    </Card>
  );
}
