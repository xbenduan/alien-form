import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
import { useBlock, usePage, useRuntime, type ComponentProps } from "@alien-form/engine/react";
import { useTableContext, useRowRecord } from "./table-context";

export function ActionAdd({ node }: ComponentProps) {
  const page = usePage();
  const runtime = useRuntime();
  const targetBlock = (node.props?.targetBlock as string) ?? "form";

  return (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => runtime.bus.emit("overlay:open", { mode: "add", block: targetBlock, model: page.schema.id })}
    >
      新增
    </Button>
  );
}

export function ActionRefresh({ node }: ComponentProps) {
  const block = useBlock(node.block ?? "main");
  const listBlock = block as unknown as { refresh: () => void };
  return (
    <Button icon={<ReloadOutlined />} onClick={() => listBlock.refresh()} aria-label="刷新" />
  );
}

export function ActionBatchDelete() {
  const { selectedRowKeys, onBatchDelete } = useTableContext();
  const ids = selectedRowKeys.map(String);
  if (!ids.length) return null;
  return (
    <Popconfirm
      title={`确认删除选中的 ${ids.length} 条记录吗？`}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={() => onBatchDelete(ids)}
    >
      <Button icon={<DeleteOutlined />} danger>
        批量删除
      </Button>
    </Popconfirm>
  );
}

export function RowDetail() {
  const row = useRowRecord();
  const runtime = useRuntime();
  const page = usePage();
  return (
    <Button
      type="link"
      size="small"
      icon={<EyeOutlined />}
      onClick={() => runtime.bus.emit("overlay:open", { mode: "detail", id: String(row.id), model: page.schema.id })}
    >
      详情
    </Button>
  );
}

export function RowEdit() {
  const row = useRowRecord();
  const runtime = useRuntime();
  const page = usePage();
  return (
    <Button
      type="link"
      size="small"
      icon={<EditOutlined />}
      onClick={() => runtime.bus.emit("overlay:open", { mode: "edit", id: String(row.id), model: page.schema.id })}
    >
      编辑
    </Button>
  );
}

export function RowDelete() {
  const row = useRowRecord();
  const { onDelete } = useTableContext();
  return (
    <Popconfirm
      title="确认删除这条记录吗？"
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={() => onDelete(String(row.id))}
    >
      <Button danger type="link" size="small" icon={<DeleteOutlined />}>
        删除
      </Button>
    </Popconfirm>
  );
}

export function RowActions({ children }: ComponentProps) {
  return <>{children as React.ReactNode}</>;
}
