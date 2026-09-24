import { DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Tag, Tooltip } from "antd";
import { isContainer } from "../builder/codec";
import type { FieldNode } from "../builder/types";

interface FieldBarTreeProps {
  fields: FieldNode[];
  parentId?: string;
  onEdit: (node: FieldNode) => void;
  onRemove: (node: FieldNode) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, parentId: string | undefined, toIndex: number) => void;
}

function FieldBar({
  node,
  onEdit,
  onRemove,
  onAddChild,
  onMove,
}: {
  node: FieldNode;
} & Pick<FieldBarTreeProps, "onEdit" | "onRemove" | "onAddChild" | "onMove">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const container = isContainer(node);
  // 已发布物理字段不可删除，virtual 字段可自由调整。
  const deletable = node.source === "virtual";
  const borderRadius = container ? "8px 8px 0 0" : "8px";

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`flex items-center gap-2.5 border border-[#e5e6eb] bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] px-3 py-2 ${
          isDragging ? "opacity-60 shadow-[0_6px_18px_rgba(23,32,51,0.12)]" : ""
        }`}
        style={{ transform: CSS.Transform.toString(transform), transition, borderRadius }}
      >
        <span
          className="inline-flex cursor-grab text-[#86909c] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <HolderOutlined />
        </span>
        <span className="min-w-[120px] font-semibold">{node.key}</span>
        <Tag className="!text-[#4e5969]">{node.form.component ?? node.type}</Tag>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[#4e5969]">
          {node.title ?? "—"}
        </span>
        {node.source === "physical" ? <Tag color="blue">物理</Tag> : <Tag>虚拟</Tag>}
        <span className="inline-flex gap-0.5">
          {container ? (
            <Tooltip title="新增子项">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                aria-label="新增子项"
                onClick={() => onAddChild(node.id)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label="编辑字段"
              onClick={() => onEdit(node)}
            />
          </Tooltip>
          <Tooltip title={deletable ? "删除" : "物理字段不可删除"}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除字段"
              disabled={!deletable}
              onClick={() => onRemove(node)}
            />
          </Tooltip>
        </span>
      </div>
      {container ? (
        <div className="rounded-b-lg border border-t-0 border-dashed border-[#c9cdd4] bg-[var(--app-surface-muted,rgba(248,250,255,0.78))] px-3 py-2.5">
          <FieldBarTree
            fields={node.children ?? []}
            onEdit={onEdit}
            onRemove={onRemove}
            onAddChild={onAddChild}
            onMove={onMove}
          />
        </div>
      ) : null}
    </div>
  );
}

export function FieldBarTree({
  fields,
  parentId,
  onEdit,
  onRemove,
  onAddChild,
  onMove,
}: FieldBarTreeProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // 仅同级拖拽：只处理当前列表内的排序。
    const ids = fields.map((node) => node.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onMove(String(active.id), parentId, to);
  };

  if (fields.length === 0) {
    return (
      <div className="py-1 text-[#86909c]">
        暂无字段
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((node) => node.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {fields.map((node) => (
            <FieldBar
              key={node.id}
              node={node}
              onEdit={onEdit}
              onRemove={onRemove}
              onAddChild={onAddChild}
              onMove={onMove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
