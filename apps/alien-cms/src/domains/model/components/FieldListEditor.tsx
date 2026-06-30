import { DeleteOutlined, DragOutlined } from "../../../shared/ui";
import type { ModelBuilderFieldDraft } from "@alien-form/cms";
import { Button, Card, Empty, Space, Tag, Typography } from "../../../shared/ui";
import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface FieldListEditorProps {
  fields: ModelBuilderFieldDraft[];
  selectedFieldId?: string;
  extra?: ReactNode;
  isRemovable?: (field: ModelBuilderFieldDraft) => boolean;
  onSelect: (fieldId: string) => void;
  onRemove: (fieldId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

interface FieldListHandlers {
  isRemovable?: (field: ModelBuilderFieldDraft) => boolean;
  onSelect: (fieldId: string) => void;
  onRemove: (fieldId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

type DropPosition = "before" | "after";

interface DragState {
  draggingId?: string;
  dropTargetId?: string;
  dropPosition?: DropPosition;
}

const EMPTY_DRAG_STATE: DragState = {};

interface FieldTreeNodeProps {
  field: ModelBuilderFieldDraft;
  index: number;
  level: number;
  rootFields: ModelBuilderFieldDraft[];
  selectedFieldId?: string;
  dragState: DragState;
  setDragState: Dispatch<SetStateAction<DragState>>;
  draggingIdRef: MutableRefObject<string | undefined>;
  handlersRef: RefObject<FieldListHandlers>;
}

function containsFieldId(field: ModelBuilderFieldDraft, id?: string): boolean {
  if (!id) {
    return false;
  }
  if (field.id === id) {
    return true;
  }
  return field.children?.some((child) => containsFieldId(child, id)) ?? false;
}

function getSlotMeta(field: ModelBuilderFieldDraft) {
  if (field.type === "object") {
    return {
      label: "对象插槽",
      description: "该组件内部提供对象字段插槽，用于继续配置子字段。",
    };
  }
  if (field.type === "void") {
    return {
      label: "布局插槽",
      description: "该组件内部提供布局插槽，用于承载一组展示/录入字段。",
    };
  }
  if (field.type === "array") {
    return {
      label: field.itemTitle || "数组项插槽",
      description: "该组件内部提供数组项插槽，用于定义每一行对象的字段结构。",
    };
  }
  return undefined;
}

function resolveDropPosition(event: React.DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

const FieldTreeNode = memo(function FieldTreeNode({
  field,
  index,
  level,
  rootFields,
  selectedFieldId,
  dragState,
  setDragState,
  draggingIdRef,
  handlersRef,
}: FieldTreeNodeProps) {
  const slotMeta = getSlotMeta(field);
  const isActive = selectedFieldId === field.id;
  const isLocked = handlersRef.current?.isRemovable?.(field) === false;
  const isDraggable = level === 0;
  const isDragging = isDraggable && dragState.draggingId === field.id;
  const isDropTarget =
    isDraggable &&
    dragState.dropTargetId === field.id &&
    dragState.draggingId !== undefined &&
    dragState.draggingId !== field.id;
  const dropClass = isDropTarget
    ? dragState.dropPosition === "before"
      ? "is-drop-before"
      : "is-drop-after"
    : "";

  const itemClassName = [
    "builder-field-item",
    isActive ? "is-active" : "",
    isDragging ? "is-dragging" : "",
    dropClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="builder-field-tree-node" style={{ paddingLeft: level * 18 }}>
      <div
        draggable={isDraggable}
        className={itemClassName}
        onClick={() => handlersRef.current?.onSelect(field.id)}
        onDragStart={(event) => {
          if (!isDraggable) {
            return;
          }
          draggingIdRef.current = field.id;
          event.dataTransfer.effectAllowed = "move";
          try {
            event.dataTransfer.setData("text/plain", field.id);
          } catch {
            // Some browsers throw when setData is called outside drag flow; safe to ignore.
          }
          setDragState({ draggingId: field.id });
        }}
        onDragOver={(event) => {
          if (!isDraggable) {
            return;
          }
          const draggingId = draggingIdRef.current;
          if (!draggingId || draggingId === field.id) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const position = resolveDropPosition(event);
          setDragState((prev) => {
            if (
              prev.draggingId === draggingId &&
              prev.dropTargetId === field.id &&
              prev.dropPosition === position
            ) {
              return prev;
            }
            return {
              draggingId,
              dropTargetId: field.id,
              dropPosition: position,
            };
          });
        }}
        onDragLeave={(event) => {
          if (!isDraggable) {
            return;
          }
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && event.currentTarget.contains(nextTarget)) {
            return;
          }
          setDragState((prev) =>
            prev.dropTargetId === field.id ? { draggingId: prev.draggingId } : prev,
          );
        }}
        onDrop={(event) => {
          if (!isDraggable) {
            return;
          }
          event.preventDefault();
          const draggingId = draggingIdRef.current;
          const position = resolveDropPosition(event);
          draggingIdRef.current = undefined;
          setDragState(EMPTY_DRAG_STATE);
          if (!draggingId || draggingId === field.id) {
            return;
          }
          const fromIndex = rootFields.findIndex((item) => item.id === draggingId);
          if (fromIndex < 0) {
            return;
          }
          const insertIndex = position === "before" ? index : index + 1;
          const toIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
          if (toIndex === fromIndex) {
            return;
          }
          handlersRef.current?.onMove(fromIndex, toIndex);
        }}
        onDragEnd={() => {
          draggingIdRef.current = undefined;
          setDragState(EMPTY_DRAG_STATE);
        }}
      >
        <Space align="center" size={8}>
          <DragOutlined className="builder-field-item-handle" />
          <div>
            <Typography.Text strong>{field.title || "未命名字段"}</Typography.Text>
            <div className="builder-field-item-meta">
              <span>{field.key || "未设置 key"}</span>
              <Tag variant="filled">{field.type}</Tag>
              <Tag variant="filled">{field.component}</Tag>
              {isLocked ? <Tag color="gold">系统</Tag> : null}
            </div>
          </div>
        </Space>
        {isLocked ? null : (
          <Space size={4}>
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                handlersRef.current?.onRemove(field.id);
              }}
            />
          </Space>
        )}
      </div>
      {slotMeta ? (
        <div className="builder-slot-panel">
          <div className="builder-slot-header">
            <div>
              <Typography.Text strong>{slotMeta.label}</Typography.Text>
              <div className="builder-slot-description">{slotMeta.description}</div>
            </div>
          </div>
          {field.children?.length ? (
            <div className="builder-field-children">
              {field.children.map((child, childIndex) => (
                <FieldTreeNode
                  key={child.id}
                  field={child}
                  index={childIndex}
                  level={level + 1}
                  rootFields={rootFields}
                  selectedFieldId={selectedFieldId}
                  dragState={dragState}
                  setDragState={setDragState}
                  draggingIdRef={draggingIdRef}
                  handlersRef={handlersRef}
                />
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该插槽下还没有字段" />
          )}
        </div>
      ) : null}
    </div>
  );
}, areFieldTreeNodePropsEqual);

function areFieldTreeNodePropsEqual(prevProps: FieldTreeNodeProps, nextProps: FieldTreeNodeProps) {
  if (prevProps.field !== nextProps.field) {
    return false;
  }
  if (prevProps.index !== nextProps.index || prevProps.level !== nextProps.level) {
    return false;
  }
  if (prevProps.rootFields !== nextProps.rootFields) {
    return false;
  }
  if (prevProps.handlersRef !== nextProps.handlersRef) {
    return false;
  }
  if (prevProps.draggingIdRef !== nextProps.draggingIdRef) {
    return false;
  }
  if (prevProps.setDragState !== nextProps.setDragState) {
    return false;
  }

  const prevSelectedInTree = containsFieldId(prevProps.field, prevProps.selectedFieldId);
  const nextSelectedInTree = containsFieldId(nextProps.field, nextProps.selectedFieldId);
  if (prevSelectedInTree !== nextSelectedInTree) {
    return false;
  }
  if (prevSelectedInTree && prevProps.selectedFieldId !== nextProps.selectedFieldId) {
    return false;
  }

  if (prevProps.dragState !== nextProps.dragState) {
    if (dragStateAffectsField(prevProps.dragState, prevProps.field)) {
      return false;
    }
    if (dragStateAffectsField(nextProps.dragState, nextProps.field)) {
      return false;
    }
  }

  return true;
}

function dragStateAffectsField(state: DragState, field: ModelBuilderFieldDraft) {
  return containsFieldId(field, state.draggingId) || containsFieldId(field, state.dropTargetId);
}

export function FieldListEditor({
  fields,
  selectedFieldId,
  extra,
  isRemovable,
  onSelect,
  onRemove,
  onMove,
}: FieldListEditorProps) {
  const [dragState, setDragState] = useState<DragState>(EMPTY_DRAG_STATE);
  const draggingIdRef = useRef<string | undefined>(undefined);
  const handlersRef = useRef<FieldListHandlers>({
    isRemovable,
    onSelect,
    onRemove,
    onMove,
  });

  useEffect(() => {
    handlersRef.current = {
      isRemovable,
      onSelect,
      onRemove,
      onMove,
    };
  }, [isRemovable, onMove, onRemove, onSelect]);

  const handleListDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setDragState((prev) => (prev.dropTargetId ? { draggingId: prev.draggingId } : prev));
  }, []);

  return (
    <Card
      className="model-query-card"
      title="字段列表"
      extra={extra}
      styles={{ body: { padding: 16 } }}
    >
      {fields.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先从左侧添加一个字段" />
      ) : null}

      <div className="builder-field-list" onDragLeave={handleListDragLeave}>
        {fields.map((field, index) => (
          <FieldTreeNode
            key={field.id}
            field={field}
            index={index}
            level={0}
            rootFields={fields}
            selectedFieldId={selectedFieldId}
            dragState={dragState}
            setDragState={setDragState}
            draggingIdRef={draggingIdRef}
            handlersRef={handlersRef}
          />
        ))}
      </div>
    </Card>
  );
}
