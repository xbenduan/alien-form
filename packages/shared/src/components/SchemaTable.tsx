import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { App, Button, Space, Tooltip } from "antd";
import type { TableProps } from "antd";
import type { ColumnType } from "antd/es/table";
import type { MessageInstance } from "antd/es/message/interface";
import type { TableRowSelection } from "antd/es/table/interface";
import type { Key, ReactNode } from "react";
import { useState } from "react";
import { TableScene } from "../scenes/table";
import type { SchemaHandlers, SchemaRecord, TableColumnProjection } from "../types";
import { ColumnVisibilityModal } from "./ColumnVisibilityModal";
import { FieldDetailModal } from "./SchemaDetail";

export interface TableColumnSetting {
  options: Array<{ label: string; value: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  onReset: () => void;
}

export interface TableActions {
  onAdd?: () => void;
  onRefresh?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onBatchDelete?: (keys: Key[]) => void;
  addText?: string;
}

export interface SchemaTableProps {
  columns: TableColumnProjection[];
  dataSource: SchemaRecord[];
  loading?: boolean;
  total?: number;
  pagination?: TableProps<SchemaRecord>["pagination"];
  rowKey?: string;
  rowSelection?: TableRowSelection<SchemaRecord>;
  sorter?: { field?: string; order?: "ascend" | "descend" };
  onChange?: TableProps<SchemaRecord>["onChange"];
  actionsColumn?: ColumnType<SchemaRecord>;
  actions?: TableActions;
  detailHandlers?: SchemaHandlers;
  toolbarLeftExtra?: ReactNode;
  toolbarRightExtra?: ReactNode;
  columnSetting?: TableColumnSetting;
  selectedRowKeys?: Key[];
}

export function handleBatchDelete(
  selectedRowKeys: Key[],
  onBatchDelete: ((keys: Key[]) => void) | undefined,
  messageApi: MessageInstance,
) {
  if (!onBatchDelete) {
    messageApi.info("批量操作开发中");
    return;
  }
  onBatchDelete(selectedRowKeys);
}

function BatchActions({
  selectedRowKeys,
  onBatchDelete,
  messageApi,
}: {
  selectedRowKeys?: Key[];
  onBatchDelete?: (keys: Key[]) => void;
  messageApi: MessageInstance;
}) {
  const count = selectedRowKeys?.length ?? 0;
  if (count === 0) return <span className="schema-table-toolbar-hint" />;

  return (
    <Space>
      <span className="schema-table-toolbar-selected">已选 {count} 项</span>
      <Button
        size="small"
        danger
        onClick={() => {
          handleBatchDelete(selectedRowKeys ?? [], onBatchDelete, messageApi);
        }}
      >
        批量删除
      </Button>
    </Space>
  );
}

export function SchemaTable({
  columns,
  dataSource,
  loading,
  total,
  pagination,
  rowKey = "id",
  rowSelection,
  sorter,
  onChange,
  actionsColumn,
  actions,
  detailHandlers,
  toolbarLeftExtra,
  toolbarRightExtra,
  columnSetting,
  selectedRowKeys,
}: SchemaTableProps) {
  const { message: messageApi } = App.useApp();
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [detailState, setDetailState] = useState<{
    column?: TableColumnProjection;
    record?: SchemaRecord;
  }>({});

  return (
    <div className="schema-table">
      <div className="schema-table-toolbar">
        <div className="schema-table-toolbar-left">
          <BatchActions
            selectedRowKeys={selectedRowKeys}
            onBatchDelete={actions?.onBatchDelete}
            messageApi={messageApi}
          />
          {toolbarLeftExtra}
        </div>
        <div className="schema-table-toolbar-right">
          <Space size={8}>
            {toolbarRightExtra}
            {actions?.onRefresh ? (
              <Tooltip title="刷新">
                <Button icon={<ReloadOutlined />} onClick={actions.onRefresh} aria-label="刷新" />
              </Tooltip>
            ) : null}
            {columnSetting ? (
              <Tooltip title="列设置">
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setColumnModalOpen(true)}
                  aria-label="列设置"
                />
              </Tooltip>
            ) : null}
            {actions?.onImport ? (
              <Tooltip title="导入">
                <Button icon={<UploadOutlined />} onClick={actions.onImport} aria-label="导入" />
              </Tooltip>
            ) : null}
            {actions?.onExport ? (
              <Tooltip title="导出">
                <Button icon={<DownloadOutlined />} onClick={actions.onExport} aria-label="导出" />
              </Tooltip>
            ) : null}
            {actions?.onAdd ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={actions.onAdd}>
                {actions.addText ?? "新增"}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>
      <div className="schema-table-body">
        <TableScene
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          total={total}
          pagination={pagination}
          rowKey={rowKey}
          rowSelection={rowSelection}
          sorter={sorter}
          onChange={onChange}
          actionsColumn={actionsColumn}
          onOpenDetail={(column, record) => setDetailState({ column, record })}
        />
      </div>
      {columnSetting ? (
        <ColumnVisibilityModal
          open={columnModalOpen}
          options={columnSetting.options}
          values={columnSetting.values}
          onChange={columnSetting.onChange}
          onReset={columnSetting.onReset}
          onClose={() => setColumnModalOpen(false)}
        />
      ) : null}
      <FieldDetailModal
        open={Boolean(detailState.column && detailState.record)}
        column={detailState.column}
        record={detailState.record}
        handlers={detailHandlers}
        onClose={() => setDetailState({})}
      />
    </div>
  );
}
