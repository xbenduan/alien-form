import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
import { useNavigate } from "react-router-dom";
import { useBlock, usePage, useRuntime, type ComponentProps } from "@alien-form/engine/react";
import { useTableContext, useRowRecord } from "./table-context";
import { recordAddPath, recordDetailPath, recordEditPath } from "../../../app/router/paths";

type ActionMode = "add" | "edit" | "detail";
type OpenMode = "page" | "drawer" | "modal";

/** 从页面 meta 读取某动作的打开方式（缺省 drawer）。 */
function useOpenMode(mode: ActionMode): OpenMode {
  const page = usePage();
  const openMode = (page.schema.meta?.openMode as Record<ActionMode, OpenMode> | undefined)?.[mode];
  return openMode ?? "drawer";
}

export function ActionAdd({ node }: ComponentProps) {
  const page = usePage();
  const runtime = useRuntime();
  const navigate = useNavigate();
  const openMode = useOpenMode("add");
  const model = page.domain;
  const targetBlock = (node.props?.targetBlock as string) ?? "form";

  const onClick = () => {
    if (openMode === "page") {
      navigate(recordAddPath(model));
      return;
    }
    runtime.bus.emit("overlay:open", { mode: "add", block: targetBlock, model, openMode });
  };

  return (
    <Button type="primary" icon={<PlusOutlined />} onClick={onClick}>
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
  const navigate = useNavigate();
  const page = usePage();
  const openMode = useOpenMode("detail");
  const model = page.domain;
  const id = String(row.id);

  const onClick = () => {
    if (openMode === "page") {
      navigate(recordDetailPath(model, id));
      return;
    }
    runtime.bus.emit("overlay:open", { mode: "detail", id, model, openMode });
  };

  return (
    <Button type="link" size="small" icon={<EyeOutlined />} onClick={onClick}>
      详情
    </Button>
  );
}

export function RowEdit() {
  const row = useRowRecord();
  const runtime = useRuntime();
  const navigate = useNavigate();
  const page = usePage();
  const openMode = useOpenMode("edit");
  const model = page.domain;
  const id = String(row.id);

  const onClick = () => {
    if (openMode === "page") {
      navigate(recordEditPath(model, id));
      return;
    }
    runtime.bus.emit("overlay:open", { mode: "edit", id, model, openMode });
  };

  return (
    <Button type="link" size="small" icon={<EditOutlined />} onClick={onClick}>
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
