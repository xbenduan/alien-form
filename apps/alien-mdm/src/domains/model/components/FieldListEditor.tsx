import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Tag } from "antd";
import { useRef, useState, type DragEvent, type ReactElement } from "react";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import { ModelCodec, type FieldDraft, type ModelDraft } from "../builder";
import { componentAlias, isContainerField } from "../utils";
import { FieldEditor, type FieldEditorRef } from "./FieldEditor";
import styles from "./index.module.css";

type EditorState =
  | { mode: "add"; parentId?: string; field: FieldDraft }
  | { mode: "edit"; field: FieldDraft }
  | undefined;

function draftTitle(field: FieldDraft): string {
  return field.fields.title || field.fields.key || "";
}

export function FieldListEditor() {
  const builder = useBuilder<ModelDraft>();
  const document = useBuilderAtom(builder.document);
  const fields = document.fields;
  const codec = useRef(new ModelCodec()).current;
  const [editor, setEditor] = useState<EditorState>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const fieldEditorRef = useRef<FieldEditorRef>(null);

  const finishDrag = () => {
    setDraggingId(undefined);
    setDropTargetId(undefined);
  };

  const saveField = async () => {
    if (!editor || !fieldEditorRef.current) return;
    try {
      const field = await fieldEditorRef.current.submit();
      if (editor.mode === "edit") {
        builder.dispatch("field.update", { id: editor.field.id, field });
      } else {
        builder.dispatch("field.add", { field, parentId: editor.parentId });
      }
      setEditor(undefined);
    } catch {
      return;
    }
  };

  const renderActions = (field: FieldDraft) => (
    <div className={styles.actions}>
      {isContainerField(field.fields.component) ? (
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          aria-label={`为${draftTitle(field)}添加子字段`}
          onClick={(event) => {
            event.stopPropagation();
            setEditor({
              mode: "add",
              parentId: field.id,
              field: codec.createField("Input", document.name),
            });
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
          builder.dispatch("field.remove", { id: field.id });
        }}
      />
    </div>
  );

  const renderField = (field: FieldDraft, nested = false): ReactElement => {
    const container = isContainerField(field.fields.component);
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
          onDragStart={(event: DragEvent<HTMLDivElement>) => {
            event.dataTransfer.effectAllowed = "move";
            setDraggingId(field.id);
          }}
          onDragEnd={finishDrag}
          onDragOver={(event) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTargetId(field.id);
          }}
          onDrop={(event) => {
            event.stopPropagation();
            event.preventDefault();
            if (draggingId) builder.dispatch("field.move", { id: draggingId, targetId: field.id });
            finishDrag();
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
              if (draggingId) {
                builder.dispatch("field.move", { id: draggingId, parentId: field.id });
              }
              finishDrag();
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
        onClick={() =>
          setEditor({ mode: "add", field: codec.createField("Input", document.name) })
        }
      >
        添加字段
      </Button>
      <Modal
        centered
        destroyOnHidden
        open={Boolean(editor)}
        title={editor?.mode === "edit" ? "编辑字段" : "新增字段"}
        width={620}
        onCancel={() => setEditor(undefined)}
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
