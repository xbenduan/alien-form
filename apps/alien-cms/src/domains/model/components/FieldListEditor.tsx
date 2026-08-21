import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Tag } from "antd";
import { useRef, useState, type DragEvent, type ReactElement } from "react";
import type { FieldDraft } from "../types";
import { componentAlias, isContainerField } from "../utils";
import { useCompiler } from "../../../compiler";
import { FieldEditor, type FieldEditorRef } from "./FieldEditor";
import styles from "./index.module.css";

interface FieldListEditorProps {
  fields: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
}

type EditorState =
  | { mode: "add"; parentId?: string; field: FieldDraft }
  | { mode: "edit"; field: FieldDraft }
  | undefined;

interface RemovedField {
  fields: FieldDraft[];
  field?: FieldDraft;
}

/** 草稿显示标题：优先字段 schema 的 title，回退到 key。 */
function draftTitle(field: FieldDraft): string {
  return field.fields.title || field.fields.key || "";
}

/** 草稿是否为可嵌套子字段的容器：由字段 schema 的 component 判定。 */
function isContainerDraft(field: FieldDraft): boolean {
  return isContainerField(field.fields.component);
}

function updateField(
  fields: FieldDraft[],
  id: string,
  updater: (field: FieldDraft) => FieldDraft,
): FieldDraft[] {
  return fields.map((field) => {
    if (field.id === id) return updater(field);
    if (field.children) return { ...field, children: updateField(field.children, id, updater) };
    return field;
  });
}

function removeField(fields: FieldDraft[], id: string): RemovedField {
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.id === id) {
      return {
        fields: [...fields.slice(0, index), ...fields.slice(index + 1)],
        field,
      };
    }
    if (field.children) {
      const result = removeField(field.children, id);
      if (result.field) {
        return {
          fields: fields.map((item) =>
            item.id === field.id ? { ...item, children: result.fields } : item,
          ),
          field: result.field,
        };
      }
    }
  }
  return { fields };
}

function insertBefore(fields: FieldDraft[], targetId: string, field: FieldDraft): FieldDraft[] {
  const index = fields.findIndex((item) => item.id === targetId);
  if (index >= 0) {
    return [...fields.slice(0, index), field, ...fields.slice(index)];
  }
  return fields.map((item) =>
    item.children
      ? { ...item, children: insertBefore(item.children, targetId, field) }
      : item,
  );
}

function appendToContainer(
  fields: FieldDraft[],
  containerId: string,
  field: FieldDraft,
): FieldDraft[] {
  return fields.map((item) => {
    if (item.id === containerId) {
      return { ...item, children: [...(item.children ?? []), field] };
    }
    return item.children
      ? { ...item, children: appendToContainer(item.children, containerId, field) }
      : item;
  });
}

function containsField(field: FieldDraft, id: string): boolean {
  return field.id === id || Boolean(field.children?.some((child) => containsField(child, id)));
}

/** 字段树编辑：支持同级排序，以及拖入对象/对象数组容器形成嵌套字段。 */
export function FieldListEditor({ fields, onChange }: FieldListEditorProps) {
  const compiler = useCompiler();
  const [editor, setEditor] = useState<EditorState>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const fieldEditorRef = useRef<FieldEditorRef>(null);

  const moveBefore = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const removed = removeField(fields, draggingId);
    if (!removed.field || containsField(removed.field, targetId)) return;
    onChange(insertBefore(removed.fields, targetId, removed.field));
  };

  const moveInto = (containerId: string) => {
    if (!draggingId || draggingId === containerId) return;
    const removed = removeField(fields, draggingId);
    if (!removed.field || containsField(removed.field, containerId)) return;
    onChange(appendToContainer(removed.fields, containerId, removed.field));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, field: FieldDraft) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", field.id);
    setDraggingId(field.id);
  };

  const handleDragEnd = () => {
    setDraggingId(undefined);
    setDropTargetId(undefined);
  };

  const remove = (id: string) => {
    onChange(removeField(fields, id).fields);
  };

  const addChild = (parent: FieldDraft) => {
    setEditor({ mode: "add", parentId: parent.id, field: compiler.createFieldDraft() });
  };

  const saveField = async () => {
    if (!editor || !fieldEditorRef.current) return;
    try {
      const field = await fieldEditorRef.current.submit();

      if (editor.mode === "edit") {
        onChange(updateField(fields, editor.field.id, () => field));
      } else if (editor.parentId) {
        onChange(
          updateField(fields, editor.parentId, (parent) => ({
            ...parent,
            children: [...(parent.children ?? []), field],
          })),
        );
      } else {
        onChange([...fields, field]);
      }
    } catch {
      return;
    }
    setEditor(undefined);
  };

  const renderActions = (field: FieldDraft) => (
    <div className={styles.actions}>
      {isContainerDraft(field) ? (
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          aria-label={`为${draftTitle(field)}添加子字段`}
          onClick={(event) => {
            event.stopPropagation();
            addChild(field);
          }}
        />
      ) : null}
      <Button
        type="text"
        size="small"
        icon={<EditOutlined />}
        aria-label={`编辑${draftTitle(field)}`}
        onClick={(event) => {
          event.stopPropagation();
          setEditor({ mode: "edit", field });
        }}
      />
      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        aria-label={`删除${draftTitle(field)}`}
        onClick={(event) => {
          event.stopPropagation();
          remove(field.id);
        }}
      />
    </div>
  );

  const renderField = (field: FieldDraft, nested = false): ReactElement => {
    const container = isContainerDraft(field);
    const itemClass = [
      styles.item,
      nested ? styles.nested : "",
      dropTargetId === field.id ? styles.dropTarget : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div key={field.id} className={container ? styles.container : undefined}>
        <div
          className={itemClass}
          draggable
          onDragStart={(event) => handleDragStart(event, field)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTargetId(field.id);
          }}
          onDrop={(event) => {
            event.stopPropagation();
            event.preventDefault();
            moveBefore(field.id);
            handleDragEnd();
          }}
        >
          <div className={styles.itemMain}>
            <span className={styles.dragHandle} aria-hidden="true">
              ⋮⋮
            </span>
            <span className={styles.itemTitle}>{draftTitle(field)}</span>
            <Tag>{componentAlias(field.fields.component)}</Tag>
          </div>
          {renderActions(field)}
        </div>
        {container ? (
          <div
            className={`${styles.children}${dropTargetId === `${field.id}-children` ? ` ${styles.dropTarget}` : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetId(`${field.id}-children`);
            }}
            onDrop={(event) => {
              event.preventDefault();
              moveInto(field.id);
              handleDragEnd();
            }}
          >
            {(field.children ?? []).map((child) => renderField(child, true))}
            {!field.children?.length ? (
              <span className={styles.dropHint}>拖动字段到此处嵌套</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${styles.fieldListEditor} ${styles.list}`}>
      {fields.length === 0 ? <Empty description="还没有字段" /> : null}
      {fields.map((field) => renderField(field))}
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setEditor({ mode: "add", field: compiler.createFieldDraft() })}
      >
        添加字段
      </Button>
      <Modal
        centered
        destroyOnHidden
        open={Boolean(editor)}
        title={editor?.mode === "edit" ? "编辑字段" : "新增字段"}
        width={620}
        onCancel={() => {
          setEditor(undefined);
        }}
        onOk={saveField}
        okText={editor?.mode === "edit" ? "保存" : "确认新增"}
        cancelText="取消"
        styles={{ body: { maxHeight: "calc(100vh - 260px)", overflowY: "auto" } }}
      >
        {editor ? (
          <FieldEditor
            ref={fieldEditorRef}
            field={editor.field}
            onChange={(field) => setEditor({ ...editor, field })}
          />
        ) : null}
      </Modal>
    </div>
  );
}
