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
  Input,
  Layout as AntLayout,
  Popconfirm,
  Space,
  Spin,
  Table as AntTable,
  Tree as AntTree,
  type TableColumnsType,
  type TableProps,
} from "antd";
import { useCallback, useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePage, type ComponentProps } from "@binding";
import type { FieldSchema, ModelOpenModes, OpenMode } from "@engine";
import { transport } from "@runtime/transport";
import { recordRoute } from "@utils/record-route";
import { RecordActionOverlay, type RecordActionMode } from "../pages";
import styles from "./index.module.css";

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  const main = (
    <AntLayout.Content
      className={styles.layoutMain}
      style={{
        background: "transparent",
      }}
    >
      {slots.rightTop}
      {slots.rightBottom}
      {children}
    </AntLayout.Content>
  );

  if (!slots.left) {
    return <AntLayout className={styles.layoutStack}>{main}</AntLayout>;
  }
  return (
    <AntLayout hasSider className={styles.layout} style={{ background: "transparent" }}>
      <AntLayout.Sider
        className={styles.layoutLeft}
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
  const page = usePage();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => parseFilter(value));
  const fields = Object.entries(schema?.properties ?? {}).filter(
    ([, field]) =>
      field["x-table"]?.filterable === true ||
      (field["x-database"] as { filterable?: boolean } | undefined)?.filterable === true,
  );
  const visibleCount = Math.max(1, page.model.meta.filterCount ?? 4);
  const hasExtraFields = fields.length > visibleCount;

  useEffect(() => {
    setDraft(parseFilter(value));
  }, [value]);

  const update = (key: string, next: string) => {
    setDraft((current) => ({ ...current, [key]: next || undefined }));
  };
  const reset = () => {
    setDraft({});
    onChange?.("{}");
  };

  return (
    <Card className={styles.filterCard} styles={{ body: { padding: 16 } }}>
      <div className={styles.filter}>
        <div className={styles.filterFields}>
          {fields.map(([key, field], index) => (
            <label
              key={key}
              className={styles.filterField}
              style={!expanded && index >= visibleCount ? { display: "none" } : undefined}
            >
              <span className={styles.filterLabel}>{field.title ?? key}</span>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={`请输入${field.title ?? key}`}
                value={String(draft[key] ?? "")}
                onChange={(event) => update(key, event.target.value)}
                onPressEnter={() => onChange?.(JSON.stringify(draft))}
              />
            </label>
          ))}
        </div>
        <div className={styles.filterActions}>
          <Space>
            {hasExtraFields && (
              <Button type="link" onClick={() => setExpanded((current) => !current)}>
                {expanded ? "收起" : "展开"}
              </Button>
            )}
            <Button onClick={reset}>重置</Button>
            <Button type="primary" onClick={() => onChange?.(JSON.stringify(draft))}>
              查询
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}

interface ListResult {
  list: Record<string, unknown>[];
  total: number;
}

interface OverlayState {
  mode: RecordActionMode;
  openMode: Exclude<OpenMode, "page">;
  recordId?: string;
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
  scroll,
}: ComponentProps & {
  schema?: FieldSchema;
  columns?:
    | TableColumnsType<Record<string, unknown>>
    | ((schema?: FieldSchema, domain?: string) => TableColumnsType<Record<string, unknown>>);
  loadData?: (params: Record<string, unknown>) => Promise<ListResult>;
  filter?: string;
  nodeId?: unknown;
  rowKey?: string;
  modelCode?: string;
  scroll?: TableProps<Record<string, unknown>>["scroll"];
}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const pageRuntime = usePage();
  const { modelCode: routeModelCode } = useParams();
  const resolvedModelCode = modelCode ?? routeModelCode ?? pageRuntime.domain;
  const pageSize = pageRuntime.model.meta.defaultPageSize ?? 20;
  const recordTitle =
    pageRuntime.model.meta.singularLabel ?? pageRuntime.model.meta.title ?? resolvedModelCode;
  const [data, setData] = useState<ListResult>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [overlay, setOverlay] = useState<OverlayState>();
  const resolvedColumns = useMemo(
    () => (typeof columns === "function" ? columns(schema, resolvedModelCode) : columns) ?? [],
    [columns, resolvedModelCode, schema],
  );
  const refresh = useCallback(async () => {
    if (!loadData) return;
    setLoading(true);
    try {
      setData(
        await loadData({
          filters: { ...parseFilter(filter), nodeId },
          pagination: { current: page, pageSize },
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [filter, loadData, nodeId, page, pageSize]);
  const openAction = useCallback(
    (mode: RecordActionMode, recordId?: unknown) => {
      if (!resolvedModelCode) return;
      const openMode: OpenMode =
        (pageRuntime.model.meta.openMode as ModelOpenModes | undefined)?.[mode] ?? "drawer";
      if (openMode === "page") {
        navigate(recordRoute(resolvedModelCode, mode, recordId));
        return;
      }
      setOverlay({
        mode,
        openMode,
        recordId: recordId === undefined ? undefined : String(recordId),
      });
    },
    [navigate, pageRuntime.model.meta.openMode, resolvedModelCode],
  );
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
  const removeSelected = useCallback(async () => {
    if (!resolvedModelCode || !selectedRowKeys.length) return;
    setLoading(true);
    try {
      await transport.send(`/api/records/${encodeURIComponent(resolvedModelCode)}/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ ids: selectedRowKeys.map(String) }),
      });
      message.success(`已删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      await refresh();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [message, refresh, resolvedModelCode, selectedRowKeys]);
  const tableColumns = useMemo<TableColumnsType<Record<string, unknown>>>(() => {
    if (!resolvedModelCode) return resolvedColumns;
    return [
      ...resolvedColumns,
      {
        key: "$actions",
        title: "操作",
        fixed: "right",
        width: 170,
        render: (_value, record) => {
          const recordId = record[rowKey];
          const hasRecordId = recordId !== undefined && recordId !== null && recordId !== "";
          const protectedAdmin =
            resolvedModelCode === "_sys_user" && String(recordId) === "_sys_admin";
          return (
            <Space size={0} wrap>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                disabled={!hasRecordId}
                onClick={() => openAction("detail", recordId)}
              >
                详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                disabled={!hasRecordId}
                onClick={() => openAction("edit", recordId)}
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
  }, [openAction, removeRecord, resolvedColumns, resolvedModelCode, rowKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
        <div className={styles.tableToolbar}>
          <Space wrap>
            {selectedRowKeys.length > 0 ? (
              <>
                <Popconfirm
                  title={`确认删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={removeSelected}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    批量删除
                  </Button>
                </Popconfirm>
                <span>已选择 {selectedRowKeys.length} 条</span>
              </>
            ) : (
              <span>批量操作</span>
            )}
          </Space>
          <Space>
            {slots.toolbar}
            <Button icon={<ReloadOutlined />} aria-label="刷新" onClick={() => void refresh()} />
            {resolvedModelCode && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAction("add")}>
                新增
              </Button>
            )}
          </Space>
        </div>
        <AntTable
          rowKey={rowKey}
          style={{ marginInline: 16 }}
          columns={tableColumns}
          dataSource={data.list}
          loading={loading}
          scroll={scroll ?? { x: "max-content" }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled:
                resolvedModelCode === "_sys_user" && String(record[rowKey]) === "_sys_admin",
            }),
          }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            onChange: setPage,
            showSizeChanger: false,
          }}
        />
      </Card>
      {overlay && resolvedModelCode && schema && (
        <RecordActionOverlay
          openMode={overlay.openMode}
          mode={overlay.mode}
          modelCode={resolvedModelCode}
          recordId={overlay.recordId}
          schema={schema}
          title={recordTitle}
          onClose={() => setOverlay(undefined)}
          onSaved={async () => {
            setOverlay(undefined);
            await refresh();
          }}
        />
      )}
    </>
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
    <Card className={styles.treeCard} size="small">
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
