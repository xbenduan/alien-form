import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  Flex,
} from "antd";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type Key,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SchemaComponent, usePage, type ComponentProps, type ValueSource } from "@alien-form/react";
import {
  buildFormSchema,
  compilePage,
  evaluateCompiledValue,
  type CompiledNode,
  type ModelFieldSchema,
  type FieldSchema,
  type OpenMode,
} from "@alien-form/engine";
import type { ListResponse } from "@alien-form/protocol";
import { recordRoute } from "@utils/record-route";
import { RecordActionOverlay } from "../pages/record-action-overlay";
import type { RecordActionMode } from "../pages/record-form";
import { useLayoutLoading } from "./loading-context";
import styles from "./table.module.css";

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

interface BatchContext {
  ids: string[];
  model: string;
  records: Record<string, unknown>[];
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
  /** 列在设置中的排序序号（越小越靠前）。缺省时回落到 schema 原始顺序。 */
  order?: number;
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
  parentId,
  node,
  rowKey = "id",
  modelCode,
  pageSize: configuredPageSize,
  pagination,
  scroll,
}: ComponentProps & {
  schema?: FieldSchema;
  columns?:
    | TableColumnsType<Record<string, unknown>>
    | ((
        schema?: FieldSchema,
        scope?: ValueSource<Record<string, unknown>>,
        domain?: string,
        fields?: ModelFieldSchema[],
      ) => TableColumnsType<Record<string, unknown>>);
  loadData?: (params: Record<string, unknown>) => Promise<ListResponse>;
  filter?: string;
  parentId?: unknown;
  rowKey?: string;
  modelCode?: string;
  pageSize?: number;
  pagination?: TableProps<Record<string, unknown>>["pagination"];
  scroll?: TableProps<Record<string, unknown>>["scroll"];
}) {
  const navigate = useNavigate();
  const pageRuntime = usePage();
  const { modelCode: routeModelCode } = useParams();
  const columnScope = useCallback(
    () => ({
      ...pageRuntime.runtime.createScope(pageRuntime.domain, pageRuntime.query, "list"),
      $form: pageRuntime.form,
    }),
    [pageRuntime],
  );
  const resolvedModelCode = modelCode ?? routeModelCode ?? pageRuntime.domain;
  const paginationConfig = typeof pagination === "object" ? pagination : {};
  const defaultPageSize =
    configuredPageSize ?? paginationConfig.pageSize ?? pageRuntime.model.defaultPageSize ?? 20;
  const recordTitle =
    pageRuntime.model.singularLabel ?? pageRuntime.model.title ?? resolvedModelCode;
  const [data, setData] = useState<ListResponse>({ list: [], total: 0 });
  const { loading, startLoading } = useLayoutLoading();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sorter, setSorter] = useState<{ field: string; order: "ascend" | "descend" }>();
  const [columnPreferences, setColumnPreferences] = useState<ColumnPreferences>(() =>
    resolvedModelCode ? readColumnPreferences(resolvedModelCode) : {},
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [overlay, setOverlay] = useState<OverlayState>();
  const loadDataRef = useRef(loadData);
  const slotNodes = useCallback(
    (name: string) => {
      const slot = node.slots[name];
      return slot ? (Array.isArray(slot) ? slot : [slot]) : [];
    },
    [node.slots],
  );
  const toolbarActionNodes = useMemo(() => slotNodes("toolbar"), [slotNodes]);
  const batchActionNodes = useMemo(() => slotNodes("batchActions"), [slotNodes]);
  const rowActionNodes = useMemo(() => slotNodes("rowActions"), [slotNodes]);
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
  /**
   * 列在设置/表格中的展示顺序：按偏好里的 order 稳定排序，缺省回落 schema 原始序。
   * 拖拽排序、列设置面板、渲染列都以它为准。
   */
  const orderedColumns = useMemo(() => {
    const orderOf = (key: string | undefined, index: number): number => {
      const order = key ? columnPreferences[key]?.order : undefined;
      return typeof order === "number" ? order : index;
    };
    return resolvedColumns
      .map((column, index) => ({ column, index, key: columnKey(column) }))
      .sort((a, b) => {
        const orderA = orderOf(a.key, a.index);
        const orderB = orderOf(b.key, b.index);
        return orderA === orderB ? a.index - b.index : orderA - orderB;
      })
      .map((item) => item.column);
  }, [columnPreferences, resolvedColumns]);
  /** 拖拽结束：把当前顺序按新位置重排，并把序号回写进每列偏好持久化。 */
  const moveColumn = useCallback(
    (activeKey: string, overKey: string) => {
      if (!resolvedModelCode || activeKey === overKey) return;
      const keys = orderedColumns.map((column) => columnKey(column)).filter(Boolean) as string[];
      const from = keys.indexOf(activeKey);
      const to = keys.indexOf(overKey);
      if (from < 0 || to < 0) return;
      const reordered = arrayMove(keys, from, to);
      setColumnPreferences((current) => {
        const next = { ...current };
        reordered.forEach((key, index) => {
          next[key] = { ...next[key], order: index };
        });
        localStorage.setItem(columnStorageKey(resolvedModelCode), JSON.stringify(next));
        return next;
      });
    },
    [orderedColumns, resolvedModelCode],
  );
  const columnSortSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const configuredColumns = useMemo(
    () =>
      orderedColumns.flatMap((column) => {
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
    [columnPreferences, orderedColumns, updateColumnPreference],
  );

  useEffect(() => {
    setColumnPreferences(resolvedModelCode ? readColumnPreferences(resolvedModelCode) : {});
  }, [resolvedModelCode]);

  useEffect(() => {
    setPageSize(defaultPageSize);
    setPage(1);
  }, [defaultPageSize]);

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  const refresh = useCallback(async () => {
    const loader = loadDataRef.current;
    if (!loader) return;
    const stopLoading = startLoading();
    try {
      setData(
        await loader({
          model: resolvedModelCode,
          filter: filter || undefined,
          parentId:
            parentId === undefined || parentId === null || parentId === ""
              ? undefined
              : String(parentId),
          pagination: { current: page, pageSize },
          sorter,
        }),
      );
    } finally {
      stopLoading();
    }
  }, [filter, page, pageSize, parentId, sorter, startLoading]);
  const openAction = useCallback(
    (mode: RecordActionMode, openMode: OpenMode = "drawer", recordId?: unknown) => {
      if (!resolvedModelCode) return;
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
            : (schema ?? buildFormSchema(pageRuntime.model, actionPage?.groups)),
        title: actionPage?.title ?? `${titlePrefix}${recordTitle}`,
        ok: formProps?.ok,
        submit: typeof formProps?.submit === "function" ? formProps.submit : undefined,
      });
    },
    [navigate, pageRuntime, recordTitle, resolvedModelCode, schema],
  );
  const renderActionNodes = useCallback(
    (
      actionNodes: CompiledNode[],
      record?: Record<string, unknown>,
      extraControlProps: Record<string, unknown> = {},
    ) =>
      actionNodes.flatMap((actionNode) => {
        const componentCode = actionNode.schema.component;
        if (!componentCode) return [];
        const receivesTableContext = ["row-button", "record-action", "batch-button"].includes(
          componentCode,
        );
        return [
          <SchemaComponent
            key={actionNode.key}
            code={componentCode}
            domain={pageRuntime.domain}
            schemaProps={actionNode.props}
            scope={() => ({
              ...pageRuntime.runtime.createScope(pageRuntime.domain, pageRuntime.query, "list"),
              $form: pageRuntime.form,
              $row: record,
            })}
            controlProps={
              receivesTableContext
                ? {
                    row: record,
                    model: resolvedModelCode,
                    rowKey,
                    refresh,
                    openAction,
                    ...extraControlProps,
                  }
                : undefined
            }
          />,
        ];
      }),
    [openAction, pageRuntime, refresh, resolvedModelCode, rowKey],
  );
  const tableColumns = useMemo<TableColumnsType<Record<string, unknown>>>(() => {
    if (rowActionNodes.length === 0) return configuredColumns;
    return [
      ...configuredColumns,
      {
        key: "$actions",
        title: "操作",
        fixed: "right",
        width: 170,
        render: (_value, record) => (
          <Space size={0} wrap>
            {renderActionNodes(rowActionNodes, record)}
          </Space>
        ),
      },
    ];
  }, [configuredColumns, renderActionNodes, rowActionNodes]);
  const batchContext = useMemo<BatchContext>(() => {
    const ids = selectedRowKeys.map(String);
    const selected = new Set(ids);
    return {
      ids,
      model: resolvedModelCode,
      records: data.list.filter((record) => selected.has(String(record[rowKey]))),
    };
  }, [data.list, resolvedModelCode, rowKey, selectedRowKeys]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [filter, parentId]);

  const columnSettings = (
    <div className={styles.columnSettings}>
      <DndContext
        sensors={columnSortSensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          const { active, over } = event;
          if (over && active.id !== over.id) moveColumn(String(active.id), String(over.id));
        }}
      >
        <SortableContext
          items={orderedColumns.map((column) => columnKey(column) ?? "").filter(Boolean)}
          strategy={verticalListSortingStrategy}
        >
          {orderedColumns.map((column) => {
            const key = columnKey(column);
            if (!key) return null;
            const preference = columnPreferences[key];
            const title = typeof column.title === "function" ? key : (column.title ?? key);
            const fixed =
              preference?.fixed ??
              (column.fixed === "left" || column.fixed === "right" ? column.fixed : undefined);
            return (
              <SortableColumnRow key={key} id={key}>
                <Checkbox
                  checked={preference?.visible ?? column.hidden !== true}
                  onChange={(event) =>
                    updateColumnPreference(key, { visible: event.target.checked })
                  }
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
              </SortableColumnRow>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );

  return (
    <>
      <Card className={styles.tableCard} styles={{ body: { padding: 0 } }}>
        <div className={styles.tableToolbar}>
          <Space wrap>
            {selectedRowKeys.length > 0 ? (
              <>
                {renderActionNodes(batchActionNodes, undefined, {
                  selection: batchContext,
                  clearSelection: () => setSelectedRowKeys([]),
                })}
                <span>已选择 {selectedRowKeys.length} 条</span>
              </>
            ) : (
              <span>批量操作</span>
            )}
          </Space>
          <Space>
            {renderActionNodes(toolbarActionNodes)}
            <Popover
              content={columnSettings}
              title={
                <Flex justify="space-between" align="center">
                  <div>列设置</div>
                  <Button
                    size="small"
                    onClick={() => {
                      if (resolvedModelCode)
                        localStorage.removeItem(columnStorageKey(resolvedModelCode));
                      setColumnPreferences({});
                    }}
                  >
                    恢复默认
                  </Button>
                </Flex>
              }
              trigger="click"
              placement="bottomRight"
            >
              <Tooltip title="列设置">
                <Button icon={<SettingOutlined />} aria-label="列设置" />
              </Tooltip>
            </Popover>
            <Button icon={<ReloadOutlined />} aria-label="刷新" onClick={() => void refresh()} />
          </Space>
        </div>
        <AntTable
          components={{ header: { cell: ResizableHeaderCell } }}
          rowKey={rowKey}
          style={{ marginInline: 16 }}
          columns={tableColumns}
          dataSource={data.list}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={scroll ?? { x: "max-content" }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled: Boolean(record.super),
            }),
          }}
          pagination={{
            ...paginationConfig,
            current: page,
            pageSize,
            total: data.total,
            pageSizeOptions: [5, 10, 20, 50],
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个模型`,
          }}
          onChange={(pagination, _filters, nextSorter) => {
            const active = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
            const field = active?.field ?? active?.columnKey;
            const nextSort =
              field && (active?.order === "ascend" || active?.order === "descend")
                ? { field: String(field), order: active.order }
                : undefined;
            const sorterChanged =
              sorter?.field !== nextSort?.field || sorter?.order !== nextSort?.order;
            setSorter(nextSort);
            if (pagination.pageSize && pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize);
              setPage(1);
              return;
            }
            setPage(sorterChanged ? 1 : (pagination.current ?? 1));
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

/** 列设置里的一行：左侧拖拽手柄触发排序，右侧沿用显隐/列宽/固定控件。 */
function SortableColumnRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.columnSettingRow}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
    >
      <span className={styles.columnDragHandle} {...attributes} {...listeners}>
        <HolderOutlined />
      </span>
      {children}
    </div>
  );
}

interface RowButtonContext {
  id?: unknown;
  model?: string;
  record: Record<string, unknown>;
}

interface RecordActionButtonProps extends Omit<ButtonProps, "disabled" | "onClick"> {
  mode: RecordActionMode;
  openMode?: OpenMode;
  row?: Record<string, unknown>;
  rowKey?: string;
  model?: string;
  openAction?: (mode: RecordActionMode, openMode: OpenMode, recordId?: unknown) => void;
  disabled?: boolean | ((row: Record<string, unknown>) => boolean);
  onClick?: (row: Record<string, unknown> | undefined, context: RowButtonContext) => unknown;
}

const RECORD_ACTION_ICONS = {
  add: <PlusOutlined />,
  edit: <EditOutlined />,
  detail: <EyeOutlined />,
} satisfies Record<RecordActionMode, ReactNode>;

const RECORD_ACTION_LABELS = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
} satisfies Record<RecordActionMode, string>;

/** Opens a record form page, modal, or drawer as a normal slotted AST node. */
export function RecordActionButton({
  mode,
  openMode = "drawer",
  row,
  rowKey = "id",
  model,
  openAction,
  disabled,
  onClick,
  type = mode === "add" ? "primary" : "text",
  size = mode === "add" ? "middle" : "small",
  children,
  ...props
}: RecordActionButtonProps) {
  const resolvedDisabled =
    !openAction || (typeof disabled === "function" ? disabled(row ?? {}) : disabled);
  const execute = async () => {
    if (!openAction) return;
    await onClick?.(row, { id: row?.[rowKey], model, record: row ?? {} });
    openAction(mode, openMode, row?.[rowKey]);
  };
  return (
    <Button
      {...props}
      type={type}
      size={size}
      icon={props.icon ?? RECORD_ACTION_ICONS[mode]}
      disabled={resolvedDisabled}
      onClick={() => void execute()}
    >
      {children ?? RECORD_ACTION_LABELS[mode]}
    </Button>
  );
}

interface BatchButtonProps extends Omit<ButtonProps, "onClick"> {
  selection?: BatchContext;
  clearSelection?: () => void;
  refresh?: () => void | Promise<void>;
  confirm?: ReactNode;
  confirmDescription?: ReactNode;
  successMessage?: string;
  refreshAfterSuccess?: boolean;
  onClick?: (selection: BatchContext) => unknown | Promise<unknown>;
}

/** Executes a batch operation with the table selection injected by its slot. */
export function BatchButton({
  selection,
  clearSelection,
  refresh,
  confirm,
  confirmDescription,
  successMessage,
  refreshAfterSuccess = false,
  onClick,
  children,
  danger,
  ...props
}: BatchButtonProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const disabled = props.disabled || !selection?.ids.length || !onClick;
  const execute = async () => {
    if (!selection || !onClick) return;
    setLoading(true);
    try {
      await onClick(selection);
      if (successMessage) message.success(successMessage);
      clearSelection?.();
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
      danger={danger}
      loading={loading}
      disabled={disabled}
      icon={props.icon ?? <DeleteOutlined />}
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
      okButtonProps={{ danger }}
      disabled={disabled}
      onConfirm={execute}
    >
      {button}
    </Popconfirm>
  ) : (
    button
  );
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
