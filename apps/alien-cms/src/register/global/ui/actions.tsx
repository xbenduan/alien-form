import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
import type { PageContext } from "../../../runtime";
import { useRecordMutations } from "../../../hooks";
import { pageOf, scopeOf, type LayoutContext } from "./types";

export function ActionAdd({ ctx }: { ctx: PageContext }) {
  return (
    <Button type="primary" icon={<PlusOutlined />} onClick={pageOf(ctx).openAdd}>
      新增
    </Button>
  );
}

export function ActionRefresh({ ctx }: { ctx: PageContext }) {
  const scope = scopeOf(ctx);
  return (
    <Button icon={<ReloadOutlined />} onClick={() => scope.refresh()} aria-label="刷新" />
  );
}

export function ActionBatchDelete({ ctx }: { ctx: PageContext }) {
  const table = (ctx as LayoutContext).table;
  const { deleteRecords } = useRecordMutations(ctx);
  const ids = table?.selectedRowKeys ?? [];
  if (!table) return null;
  return (
    <Popconfirm
      title={`确认删除选中的 ${ids.length} 条记录吗？`}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      disabled={!ids.length}
      onConfirm={async () => {
        await deleteRecords(ids.map(String));
        table.setSelectedRowKeys([]);
      }}
    >
      <Button icon={<DeleteOutlined />} danger disabled={!ids.length}>
        批量删除
      </Button>
    </Popconfirm>
  );
}

export function RowDetail({ ctx }: { ctx: PageContext }) {
  const row = (ctx as LayoutContext).table?.row;
  return row ? (
    <Button
      type="link"
      size="small"
      icon={<EyeOutlined />}
      onClick={() => pageOf(ctx).openDetail(String(row.id))}
    >
      详情
    </Button>
  ) : null;
}

export function RowEdit({ ctx }: { ctx: PageContext }) {
  const row = (ctx as LayoutContext).table?.row;
  return row ? (
    <Button
      type="link"
      size="small"
      icon={<EditOutlined />}
      onClick={() => pageOf(ctx).openEdit(String(row.id))}
    >
      编辑
    </Button>
  ) : null;
}

export function RowDelete({ ctx }: { ctx: PageContext }) {
  const row = (ctx as LayoutContext).table?.row;
  const { deleteRecord } = useRecordMutations(ctx);
  if (!row) return null;
  return (
    <Popconfirm
      title="确认删除这条记录吗？"
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={() => deleteRecord(String(row.id))}
    >
      <Button danger type="link" size="small" icon={<DeleteOutlined />}>
        删除
      </Button>
    </Popconfirm>
  );
}

export function RowActions() {
  return null;
}
