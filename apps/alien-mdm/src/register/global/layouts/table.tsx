import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Checkbox,
  InputNumber,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table as AntTable,
  Tooltip,
  type ButtonProps,
  type TableColumnsType,
  type TableProps,
} from "antd";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type Key,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePage, type ComponentProps } from "@binding";
import {
  compilePage,
  isCompiledValue,
  type CompiledNode,
  type DatabaseField,
  type FieldSchema,
  type OpenMode,
} from "@alien-form/engine";
import { recordRoute } from "@utils/record-route";
import { RecordActionOverlay } from "../pages/record-action-overlay";
import type { RecordActionMode } from "../pages/record-form";
import { parseFilter } from "./parse-filter";
import styles from "./index.module.css";

interface ListResult {
  list: Record<string, unknown>[];
  total: number;
}

interface OverlayState {
  mode: RecordActionMode;
  openMode: Exclude<OpenMode, "page">;
  modelCode: string;
  recordId?: string;
  schema: FieldSchema;
  title: string;
  ok?: ReactNode;
  submit?: (
    values: Record<string, unknown>,
    context: { mode: RecordActionMode; modelCode: string; recordId?: string },
  ) => unknown | Promise<unknown>;
}

/** action-btns 中每个按钮的可配置项（openMode 决定打开方式）。 */
interface ActionContext {
  id?: unknown;
  model: string;
  record?: Record<string, unknown>;
}

interface BatchActionContext {
  ids: string[];
  model: string;
  records: Record<string, unknown>[];
}

interface ActionButtonConfig<TContext = ActionContext> extends Omit<
  ButtonProps,
  "children" | "onClick"
> {
  openMode?: OpenMode;
  children?: ButtonProps["children"];
  service?: (context: TContext) => unknown | Promise<unknown>;
  onClick?: ButtonProps["onClick"];
}

interface ActionButtons {
  add?: ActionButtonConfig;
  edit?: ActionButtonConfig;
  detail?: ActionButtonConfig;
  delete?: ActionButtonConfig;
  batchDelete?: ActionButtonConfig<BatchActionContext>;
}

const ACTION_ICONS = {
  add: <PlusOutlined />,
  edit: <EditOutlined />,
  detail: <EyeOutlined />,
  delete: <DeleteOutlined />,
  batchDelete: <DeleteOutlined />,
} satisfies Record<keyof ActionButtons, ReactNode>;

const ACTION_LABELS = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
  delete: "删除",
  batchDelete: "批量删除",
} satisfies Record<keyof ActionButtons, string>;

function buttonProps<TContext>(config: ActionButtonConfig<TContext>): ButtonProps {
  const { children: _children, openMode: _openMode, service: _service, ...props } = config;
  return props;
}

function findComponent(nodes: CompiledNode[], component: string): CompiledNode | undefined {
  for (const node of nodes) {
    if (node.schema.component === component) return node;
    const child = findComponent(node.children, component);
    if (child) return child;
  }
  return undefined;
}

function evaluateProps(value: unknown, scope: Record<string, unknown>): unknown {
  if (isCompiledValue(value)) return value.expression(scope as never);
  if (Array.isArray(value)) return value.map((item) => evaluateProps(item, scope));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, evaluateProps(child, scope)]),
  );
}

interface ColumnPreference {
  visible?: boolean;
  width?: number;
  fixed?: "left" | "right";
}

type ColumnPreferences = Record<string, ColumnPreference>;

function columnStorageKey(modelCode: string): string {
  return `alien-form:table-columns:${modelCode}`;
}

function readColumnPreferences(modelCode: string): ColumnPreferences {
  try {
    const value = localStorage.getItem(columnStorageKey(modelCode));
    return value ? (JSON.parse(value) as ColumnPreferences) : {};
  } catch {
    return {};
  }
}

function columnKey(column: TableColumnsType<Record<string, unknown>>[number]): string | undefined {
  const key = column.key ?? ("dataIndex" in column ? column.dataIndex : undefined);
  return typeof key === "string" || typeof key === "number" ? String(key) : undefined;
}

type ResizableHeaderProps = HTMLAttributes<HTMLTableCellElement> & {
  width?: number;
  onColumnResize?: (width: number) => void;
};

function ResizableHeaderCell({ width, onColumnResize, children, ...props }: ResizableHeaderProps) {
  const startResize = (event: ReactMouseEvent) => {
    if (!width || !onColumnResize) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const move = (moveEvent: MouseEvent) =>
      onColumnResize(Math.max(80, startWidth + moveEvent.clientX - startX));
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  };

  return (
    <th {...props}>
      {children}
      {onColumnResize ? (
        <span className={styles.columnResizeHandle} onMouseDown={startResize} />
      ) : null}
    </th>
  );
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
  "action-btns": actionBtns,
}: ComponentProps & {
  schema?: FieldSchema;
  columns?:
    | TableColumnsType<Record<string, unknown>>
    | ((
        schema?: FieldSchema,
        domain?: string,
        fields?: DatabaseField[],
      ) => TableColumnsType<Record<string, unknown>>);
  loadData?: (params: Record<string, unknown>) => Promise<ListResult>;
  filter?: string;
  nodeId?: unknown;
  rowKey?: string;
  modelCode?: string;
  scroll?: TableProps<Record<string, unknown>>["scroll"];
  "action-btns"?: ActionButtons;
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
  const [sorter, setSorter] = useState<{ field: string; order: "ascend" | "descend" }>();
  const [columnPreferences, setColumnPreferences] = useState<ColumnPreferences>(() =>
    resolvedModelCode ? readColumnPreferences(resolvedModelCode) : {},
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [overlay, setOverlay] = useState<OverlayState>();
  const resolvedColumns = useMemo(
    () =>
      (typeof columns === "function"
        ? columns(schema, resolvedModelCode, pageRuntime.model.fields)
        : columns) ?? [],
    [columns, resolvedModelCode, schema, pageRuntime.model.fields],
  );
  const updateColumnPreference = useCallback(
    (key: string, patch: Partial<ColumnPreference>) => {
      if (!resolvedModelCode) return;
      setColumnPreferences((current) => {
        const next = { ...current, [key]: { ...current[key], ...patch } };
        localStorage.setItem(columnStorageKey(resolvedModelCode), JSON.stringify(next));
        return next;
      });
    },
    [resolvedModelCode],
  );
  const configuredColumns = useMemo(
    () =>
      resolvedColumns.flatMap((column) => {
        const key = columnKey(column);
        if (!key) return [column];
        const preference = columnPreferences[key];
        const visible = preference?.visible ?? column.hidden !== true;
        if (!visible) return [];
        const width = preference?.width ?? column.width ?? 160;
        return [
          {
            ...column,
            hidden: false,
            width,
            fixed: preference?.fixed ?? column.fixed,
            onHeaderCell: () =>
              ({
                width,
                onColumnResize: (nextWidth: number) =>
                  updateColumnPreference(key, { width: Math.round(nextWidth) }),
              }) as HTMLAttributes<HTMLTableCellElement>,
          },
        ];
      }),
    [columnPreferences, resolvedColumns, updateColumnPreference],
  );

  useEffect(() => {
    setColumnPreferences(resolvedModelCode ? readColumnPreferences(resolvedModelCode) : {});
  }, [resolvedModelCode]);

  const refresh = useCallback(async () => {
    if (!loadData) return;
    setLoading(true);
    try {
      setData(
        await loadData({
          filters: { ...parseFilter(filter), nodeId },
          pagination: { current: page, pageSize },
          sorter,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [filter, loadData, nodeId, page, pageSize, sorter]);
  const openAction = useCallback(
    (mode: RecordActionMode, recordId?: unknown) => {
      if (!resolvedModelCode) return;
      const openMode: OpenMode = actionBtns?.[mode]?.openMode ?? "drawer";
      if (openMode === "page") {
        navigate(recordRoute(resolvedModelCode, mode, recordId));
        return;
      }
      const actionPage = pageRuntime.model.pages.find(
        (page) => page.router.replace(/^\/+|\/+$/g, "") === mode,
      );
      const formNode = actionPage
        ? findComponent(compilePage(pageRuntime.model, actionPage).nodes, "record-form")
        : undefined;
      const resolvedRecordId = recordId === undefined ? undefined : String(recordId);
      const query = {
        ...pageRuntime.query,
        ...(resolvedRecordId ? { id: resolvedRecordId } : {}),
      };
      const formProps = formNode
        ? (evaluateProps(formNode.props, {
            ...pageRuntime.runtime.createScope(pageRuntime.domain, query, mode),
            $values: pageRuntime.form.values(),
            $form: pageRuntime.form,
          }) as Partial<OverlayState>)
        : undefined;
      const titlePrefix = mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情";
      setOverlay({
        mode,
        openMode,
        modelCode:
          typeof formProps?.modelCode === "string" ? formProps.modelCode : resolvedModelCode,
        recordId: typeof formProps?.recordId === "string" ? formProps.recordId : resolvedRecordId,
        schema:
          formProps?.schema && typeof formProps.schema === "object"
            ? formProps.schema
            : (schema ?? pageRuntime.model.definitions["form-schema"]),
        title: actionPage?.title ?? `${titlePrefix}${recordTitle}`,
        ok: formProps?.ok,
        submit: typeof formProps?.submit === "function" ? formProps.submit : undefined,
      });
    },
    [actionBtns, navigate, pageRuntime, recordTitle, resolvedModelCode, schema],
  );
  const removeRecord = useCallback(
    async (
      recordId: unknown,
      record: Record<string, unknown>,
      service?: ActionButtonConfig["service"],
    ) => {
      if (!resolvedModelCode) return;
      if (!service) {
        message.error("删除按钮未配置 service");
        return;
      }
      setLoading(true);
      try {
        await service({ id: recordId, model: resolvedModelCode, record });
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
  const removeSelected = useCallback(
    async (service?: ActionButtonConfig<BatchActionContext>["service"]) => {
      if (!resolvedModelCode || !selectedRowKeys.length) return;
      if (!service) {
        message.error("批量删除按钮未配置 service");
        return;
      }
      const ids = selectedRowKeys.map(String);
      const selected = new Set(ids);
      setLoading(true);
      try {
        await service({
          model: resolvedModelCode,
          ids,
          records: data.list.filter((record) => selected.has(String(record[rowKey]))),
        });
        message.success(`已删除 ${selectedRowKeys.length} 条记录`);
        setSelectedRowKeys([]);
        await refresh();
      } catch (reason) {
        message.error(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setLoading(false);
      }
    },
    [data.list, message, refresh, resolvedModelCode, rowKey, selectedRowKeys],
  );
  const tableColumns = useMemo<TableColumnsType<Record<string, unknown>>>(() => {
    if (
      !resolvedModelCode ||
      !actionBtns ||
      !(["edit", "detail", "delete"] as const).some((mode) => actionBtns[mode])
    ) {
      return configuredColumns;
    }
    return [
      ...configuredColumns,
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
          const inlineActions = (["edit", "detail", "delete"] as const).flatMap((mode) => {
            const config = actionBtns?.[mode];
            if (!config) return [];
            const props = buttonProps(config);
            const disabled =
              props.disabled || !hasRecordId || (mode === "delete" && protectedAdmin);
            const button = (
              <Button
                {...props}
                key={mode}
                type={props.type ?? "text"}
                size={props.size ?? "small"}
                danger={props.danger ?? mode === "delete"}
                icon={props.icon ?? ACTION_ICONS[mode]}
                disabled={disabled}
                onClick={
                  mode === "delete"
                    ? props.onClick
                    : (event) => {
                        props.onClick?.(event);
                        openAction(mode, recordId);
                      }
                }
              >
                {config.children ?? ACTION_LABELS[mode]}
              </Button>
            );
            if (mode !== "delete") return [button];
            return [
              <Popconfirm
                key={mode}
                title="确认删除这条记录？"
                description="删除后无法恢复。"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                disabled={disabled}
                onConfirm={() => removeRecord(recordId, record, config.service)}
              >
                {button}
              </Popconfirm>,
            ];
          });
          return (
            <Space size={0} wrap>
              {inlineActions}
            </Space>
          );
        },
      },
    ];
  }, [actionBtns, configuredColumns, openAction, removeRecord, resolvedModelCode, rowKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const columnSettings = (
    <div className={styles.columnSettings}>
      {resolvedColumns.map((column) => {
        const key = columnKey(column);
        if (!key) return null;
        const preference = columnPreferences[key];
        const title = typeof column.title === "function" ? key : (column.title ?? key);
        const fixed =
          preference?.fixed ??
          (column.fixed === "left" || column.fixed === "right" ? column.fixed : undefined);
        return (
          <div className={styles.columnSettingRow} key={key}>
            <Checkbox
              checked={preference?.visible ?? column.hidden !== true}
              onChange={(event) => updateColumnPreference(key, { visible: event.target.checked })}
            >
              {title}
            </Checkbox>
            <InputNumber
              aria-label={`${String(title)}列宽`}
              min={80}
              max={600}
              step={10}
              size="small"
              value={preference?.width ?? Number(column.width ?? 160)}
              onChange={(width) =>
                width !== null && updateColumnPreference(key, { width: Number(width) })
              }
            />
            <Select
              aria-label={`${String(title)}固定位置`}
              size="small"
              value={fixed ?? "none"}
              options={[
                { label: "不固定", value: "none" },
                { label: "左侧", value: "left" },
                { label: "右侧", value: "right" },
              ]}
              onChange={(fixed) =>
                updateColumnPreference(key, {
                  fixed: fixed === "left" || fixed === "right" ? fixed : undefined,
                })
              }
            />
          </div>
        );
      })}
      <Button
        size="small"
        onClick={() => {
          if (resolvedModelCode) localStorage.removeItem(columnStorageKey(resolvedModelCode));
          setColumnPreferences({});
        }}
      >
        恢复默认
      </Button>
    </div>
  );

  return (
    <>
      <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
        <div className={styles.tableToolbar}>
          <Space wrap>
            {selectedRowKeys.length > 0 ? (
              <>
                {actionBtns?.batchDelete ? (
                  <Popconfirm
                    title={`确认删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => removeSelected(actionBtns.batchDelete?.service)}
                  >
                    <Button
                      {...buttonProps(actionBtns.batchDelete)}
                      danger={actionBtns.batchDelete.danger ?? true}
                      icon={actionBtns.batchDelete.icon ?? ACTION_ICONS.batchDelete}
                      onClick={actionBtns.batchDelete.onClick}
                    >
                      {actionBtns.batchDelete.children ?? ACTION_LABELS.batchDelete}
                    </Button>
                  </Popconfirm>
                ) : null}
                <span>已选择 {selectedRowKeys.length} 条</span>
              </>
            ) : (
              <span>批量操作</span>
            )}
          </Space>
          <Space>
            {slots.toolbar}
            <Popover
              content={columnSettings}
              title="列设置"
              trigger="click"
              placement="bottomRight"
            >
              <Tooltip title="列设置">
                <Button icon={<SettingOutlined />} aria-label="列设置" />
              </Tooltip>
            </Popover>
            <Button icon={<ReloadOutlined />} aria-label="刷新" onClick={() => void refresh()} />
            {resolvedModelCode && actionBtns?.add && (
              <Button
                {...buttonProps(actionBtns.add)}
                type={actionBtns.add.type ?? "primary"}
                icon={actionBtns.add.icon ?? ACTION_ICONS.add}
                onClick={(event) => {
                  actionBtns.add?.onClick?.(event);
                  openAction("add");
                }}
              >
                {actionBtns.add.children ?? ACTION_LABELS.add}
              </Button>
            )}
          </Space>
        </div>
        <AntTable
          components={{ header: { cell: ResizableHeaderCell } }}
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
          onChange={(_pagination, _filters, nextSorter) => {
            const active = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
            const field = active?.field ?? active?.columnKey;
            setSorter(
              field && (active?.order === "ascend" || active?.order === "descend")
                ? { field: String(field), order: active.order }
                : undefined,
            );
            setPage(1);
          }}
        />
      </Card>
      {overlay && (
        <RecordActionOverlay
          openMode={overlay.openMode}
          mode={overlay.mode}
          modelCode={overlay.modelCode}
          recordId={overlay.recordId}
          schema={overlay.schema}
          title={overlay.title}
          ok={overlay.ok}
          submit={overlay.submit}
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
