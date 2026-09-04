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
  Children,
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
import { SchemaComponent, usePage, type ComponentProps, type ValueSource } from "@binding";
import {
  compilePage,
  evaluateCompiledValue,
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
  batchDelete?: ActionButtonConfig<BatchActionContext>;
}

const ACTION_ICONS = {
  add: <PlusOutlined />,
  edit: <EditOutlined />,
  detail: <EyeOutlined />,
  batchDelete: <DeleteOutlined />,
} satisfies Record<keyof ActionButtons, ReactNode>;

const ACTION_LABELS = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
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
  node,
  children,
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
        scope?: ValueSource<Record<string, unknown>>,
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
  const columnScope = useCallback(
    () => ({
      ...pageRuntime.runtime.createScope(pageRuntime.domain, pageRuntime.query, "list"),
      $values: pageRuntime.form.values(),
      $form: pageRuntime.form,
    }),
    [pageRuntime],
  );
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
  const toolbarChildren = useMemo(() => Children.toArray(children), [children]);
  const rowActionNodes = useMemo(() => {
    const rowActions = node.slots.rowActions;
    return rowActions ? (Array.isArray(rowActions) ? rowActions : [rowActions]) : [];
  }, [node.slots.rowActions]);
  const resolvedColumns = useMemo(
    () =>
      (typeof columns === "function"
        ? columns(schema, columnScope, resolvedModelCode, pageRuntime.model.fields)
        : columns) ?? [],
    [columnScope, columns, resolvedModelCode, schema, pageRuntime.model.fields],
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
        ? (evaluateCompiledValue(formNode.props, {
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
  const renderRowActions = useCallback(
    (record: Record<string, unknown>) => {
      return rowActionNodes.flatMap((actionNode) => {
        const componentCode = actionNode.schema.component;
        if (!componentCode) return [];
        return [
          <SchemaComponent
            key={actionNode.key}
            code={componentCode}
            domain={pageRuntime.domain}
            schemaProps={actionNode.props}
            scope={() => ({
              ...pageRuntime.runtime.createScope(pageRuntime.domain, pageRuntime.query, "list"),
              $values: pageRuntime.form.values(),
              $form: pageRuntime.form,
              $row: record,
            })}
            bindings={{
              row: record,
              model: resolvedModelCode,
              rowKey,
              refresh,
            }}
          />,
        ];
      });
    },
    [pageRuntime, refresh, resolvedModelCode, rowActionNodes, rowKey],
  );
  const tableColumns = useMemo<TableColumnsType<Record<string, unknown>>>(() => {
    const hasBuiltinActions =
      resolvedModelCode &&
      actionBtns &&
      (["edit", "detail"] as const).some((mode) => actionBtns[mode]);
    if (!hasBuiltinActions && rowActionNodes.length === 0) {
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
          const inlineActions = (["edit", "detail"] as const).flatMap((mode) => {
            const config = actionBtns?.[mode];
            if (!config) return [];
            const props = buttonProps(config);
            return [
              <Button
                {...props}
                key={mode}
                type={props.type ?? "text"}
                size={props.size ?? "small"}
                danger={props.danger}
                icon={props.icon ?? ACTION_ICONS[mode]}
                disabled={props.disabled || !hasRecordId}
                onClick={(event) => {
                  props.onClick?.(event);
                  openAction(mode, recordId);
                }}
              >
                {config.children ?? ACTION_LABELS[mode]}
              </Button>,
            ];
          });
          return (
            <Space size={0} wrap>
              {inlineActions}
              {renderRowActions(record)}
            </Space>
          );
        },
      },
    ];
  }, [
    actionBtns,
    configuredColumns,
    openAction,
    renderRowActions,
    resolvedModelCode,
    rowActionNodes.length,
    rowKey,
  ]);

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
            {toolbarChildren}
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
              disabled: Boolean(record.super),
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

interface RowButtonContext {
  id?: unknown;
  model?: string;
  record: Record<string, unknown>;
}

interface RowButtonProps extends Omit<ButtonProps, "disabled" | "onClick"> {
  icon?: keyof typeof ICON_MAP;
  row?: Record<string, unknown>;
  model?: string;
  rowKey?: string;
  refresh?: () => void | Promise<void>;
  confirm?: ReactNode;
  confirmDescription?: ReactNode;
  successMessage?: string;
  refreshAfterSuccess?: boolean;
  disabled?: boolean | ((row: Record<string, unknown>) => boolean);
  onClick?: (row: Record<string, unknown>, context: RowButtonContext) => unknown | Promise<unknown>;
}

const ICON_MAP = {
  edit: <EditOutlined />,
  detail: <EyeOutlined />,
  delete: <DeleteOutlined />,
  default: undefined,
};

export function RowButton({
  row,
  model,
  rowKey = "id",
  refresh,
  confirm,
  confirmDescription,
  successMessage,
  refreshAfterSuccess = false,
  disabled,
  onClick,
  type = "link",
  size = "small",
  children,
  ...props
}: RowButtonProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const resolvedDisabled =
    !row || !onClick || (typeof disabled === "function" ? disabled(row) : disabled);

  const execute = async () => {
    if (!row || !onClick) return;
    setLoading(true);
    try {
      await onClick(row, { id: row[rowKey], model, record: row });
      if (successMessage) message.success(successMessage);
      if (refreshAfterSuccess) await refresh?.();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const button = (
    <Button
      {...props}
      type={type}
      size={size}
      loading={loading}
      disabled={resolvedDisabled}
      icon={ICON_MAP[props?.icon ?? "default"]}
      onClick={confirm ? undefined : () => void execute()}
    >
      {children}
    </Button>
  );

  return confirm ? (
    <Popconfirm
      title={confirm}
      description={confirmDescription}
      okText="确认"
      cancelText="取消"
      okButtonProps={{ danger: props.danger }}
      disabled={resolvedDisabled}
      onConfirm={execute}
    >
      {button}
    </Popconfirm>
  ) : (
    button
  );
}
