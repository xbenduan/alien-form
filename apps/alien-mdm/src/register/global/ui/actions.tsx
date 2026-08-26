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
import type { ModelRecord } from "../../../runtime/types";
import { recordAddPath, recordDetailPath, recordEditPath } from "../../../app/router/paths";

type ActionMode = "add" | "edit" | "detail";
type OpenMode = "page" | "drawer" | "modal";

/** 行操作组件的注入 props：由 table 渲染行操作子节点时下发。 */
interface RowActionProps extends ComponentProps {
  record: ModelRecord;
  onDelete?: (id: string) => Promise<void> | void;
}

/** 批量操作组件的注入 props：由 table 渲染工具栏子节点时下发。 */
interface BatchActionProps extends ComponentProps {
  selectedRowKeys?: React.Key[];
  onBatchDelete?: (ids: string[]) => Promise<void> | void;
}

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
  return <Button icon={<ReloadOutlined />} onClick={() => listBlock.refresh()} aria-label="刷新" />;
}

export function ActionBatchDelete({ selectedRowKeys, onBatchDelete }: BatchActionProps) {
  const ids = (selectedRowKeys ?? []).map(String);
  if (!ids.length || !onBatchDelete) return null;
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

export function RowDetail({ record }: RowActionProps) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const page = usePage();
  const openMode = useOpenMode("detail");
  const model = page.domain;
  const id = String(record.id);

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

export function RowEdit({ record }: RowActionProps) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const page = usePage();
  const openMode = useOpenMode("edit");
  const model = page.domain;
  const id = String(record.id);

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

export function RowDelete({ record, onDelete }: RowActionProps) {
  if (!onDelete) return null;
  return (
    <Popconfirm
      title="确认删除这条记录吗？"
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={() => onDelete(String(record.id))}
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
