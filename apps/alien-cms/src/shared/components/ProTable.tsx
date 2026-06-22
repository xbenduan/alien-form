import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Card, Space, Tooltip, message } from "antd";
import type { TableProps } from "antd";
import type { ColumnType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import type { ReactNode } from "react";
import { useState } from "react";
import { ColumnVisibilityModal } from "./ColumnVisibilityModal";
import { SchemaTableBody } from "../schema-table-scene";
import type {
  CmsModelSchema,
  ModelRecord,
  TableColumnProjection,
} from "../../domains/record/types/record";

interface ProTableColumnSettingProps {
  options: Array<{ label: string; value: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  onReset: () => void;
}

interface ProTableProps {
  schema: CmsModelSchema;
  columns: TableColumnProjection[];
  dataSource: ModelRecord[];
  loading?: boolean;
  total?: number;
  pagination?: TableProps<ModelRecord>["pagination"];
  rowKey?: string;
  rowSelection?: TableRowSelection<ModelRecord>;
  sorter?: { field?: string; order?: "ascend" | "descend" };
  onChange?: TableProps<ModelRecord>["onChange"];
  actionsColumn?: ColumnType<ModelRecord>;
  toolbarLeftExtra?: ReactNode;
  toolbarRightExtra?: ReactNode;
  addButtonText?: string;
  onAdd?: () => void;
  onRefresh?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  columnSetting?: ProTableColumnSettingProps;
  selectedRowKeys?: React.Key[];
  onBatchDelete?: (keys: React.Key[]) => void;
  bodyClassName?: string;
}

function BatchActions({
  selectedRowKeys,
  onBatchDelete,
}: {
  selectedRowKeys?: React.Key[];
  onBatchDelete?: (keys: React.Key[]) => void;
}) {
  const count = selectedRowKeys?.length ?? 0;
  if (count === 0) {
    return <span className="protable-toolbar-hint" />;
  }
  return (
    <Space>
      <span className="protable-toolbar-selected">已选 {count} 项</span>
      <Button
        size="small"
        danger
        onClick={() => {
          if (!onBatchDelete) {
            message.info("批量操作开发中");
            return;
          }
          onBatchDelete(selectedRowKeys ?? []);
        }}
      >
        批量删除
      </Button>
    </Space>
  );
}

export function ProTable({
  schema,
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
  toolbarLeftExtra,
  toolbarRightExtra,
  addButtonText,
  onAdd,
  onRefresh,
  onImport,
  onExport,
  columnSetting,
  selectedRowKeys,
  onBatchDelete,
  bodyClassName,
}: ProTableProps) {
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  const placeholderImport = () => {
    if (onImport) {
      onImport();
      return;
    }
    message.info("导入功能开发中");
  };

  const placeholderExport = () => {
    if (onExport) {
      onExport();
      return;
    }
    message.info("导出功能开发中");
  };

  return (
    <div className="protable-body">
      <div className="protable-toolbar">
        <div className="protable-toolbar-left">
          <BatchActions selectedRowKeys={selectedRowKeys} onBatchDelete={onBatchDelete} />
          {toolbarLeftExtra}
        </div>
        <div className="protable-toolbar-right">
          <Space size={8}>
            {toolbarRightExtra}
            <Tooltip title="刷新">
              <Button icon={<ReloadOutlined />} onClick={onRefresh} aria-label="刷新" />
            </Tooltip>
            {columnSetting ? (
              <Tooltip title="列设置">
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setColumnModalOpen(true)}
                  aria-label="列设置"
                />
              </Tooltip>
            ) : null}
            <Tooltip title="导入">
              <Button icon={<UploadOutlined />} onClick={placeholderImport} aria-label="导入" />
            </Tooltip>
            <Tooltip title="导出">
              <Button icon={<DownloadOutlined />} onClick={placeholderExport} aria-label="导出" />
            </Tooltip>
            {onAdd ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                {addButtonText ?? "新增"}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        <SchemaTableBody
          schema={schema}
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
    </div>
  );
}

export default ProTable;
