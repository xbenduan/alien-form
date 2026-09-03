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
import type { Runtime } from "@engine";
import { isContainer, type FieldNode } from "../builder";
import styles from "./builder.module.css";

interface FieldBarTreeProps {
  fields: FieldNode[];
  runtime: Runtime;
  domain?: string;
  parentId?: string;
  onEdit: (node: FieldNode) => void;
  onRemove: (node: FieldNode) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, parentId: string | undefined, toIndex: number) => void;
}

function FieldBar({
  node,
  runtime,
  domain,
  onEdit,
  onRemove,
  onAddChild,
  onMove,
}: {
  node: FieldNode;
  runtime: Runtime;
  domain?: string;
} & Pick<FieldBarTreeProps, "onEdit" | "onRemove" | "onAddChild" | "onMove">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const container = isContainer(runtime, node, domain);
  // fields 派生字段不可删除；仅表单新增(extra)字段可删除。
  const deletable = node.source === "extra";
  const borderRadius = container ? "8px 8px 0 0" : "8px";

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`${styles.fieldBar}${isDragging ? ` ${styles.dragging}` : ""}`}
        style={{ transform: CSS.Transform.toString(transform), transition, borderRadius }}
      >
        <span className={styles.dragHandle} {...attributes} {...listeners}>
          <HolderOutlined />
        </span>
        <span className={styles.barKey}>{node.key}</span>
        <Tag className={styles.barComponent}>{node.form.component ?? node.type}</Tag>
        <span className={styles.barTitle}>{node.form.title ?? "—"}</span>
        {node.source === "field" ? <Tag color="blue">落库</Tag> : <Tag>展示</Tag>}
        <span className={styles.barActions}>
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
          <Tooltip title={deletable ? "删除" : "派生字段不可删除"}>
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
        <div className={styles.nested}>
          <FieldBarTree
            fields={node.children ?? []}
            runtime={runtime}
            domain={domain}
            parentId={node.id}
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
  runtime,
  domain,
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
      <div className={styles.muted} style={{ padding: "4px 0" }}>
        暂无字段
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((node) => node.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.fieldList}>
          {fields.map((node) => (
            <FieldBar
              key={node.id}
              node={node}
              runtime={runtime}
              domain={domain}
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
