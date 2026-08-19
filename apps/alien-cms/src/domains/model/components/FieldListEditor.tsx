import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Tag } from "antd";
import type { FieldDraft } from "../types";
import { FIELD_TYPE_META, createFieldDraft, isContainerType } from "../utils";
import styles from "./FieldListEditor.module.css";

interface FieldListEditorProps {
  fields: FieldDraft[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (fields: FieldDraft[]) => void;
}

/** 字段列表编辑：增删字段、选中编辑、容器字段管理子字段。 */
export function FieldListEditor({ fields, selectedId, onSelect, onChange }: FieldListEditorProps) {
  const addField = () => {
    const next = createFieldDraft();
    onChange([...fields, next]);
    onSelect(next.id);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((field) => field.id !== id));
  };

  const addChild = (parent: FieldDraft) => {
    const child = createFieldDraft();
    onChange(
      fields.map((field) =>
        field.id === parent.id
          ? { ...field, children: [...(field.children ?? []), child] }
          : field,
      ),
    );
    onSelect(child.id);
  };

  const removeChild = (parent: FieldDraft, childId: string) => {
    onChange(
      fields.map((field) =>
        field.id === parent.id
          ? { ...field, children: (field.children ?? []).filter((c) => c.id !== childId) }
          : field,
      ),
    );
  };

  const renderItem = (field: FieldDraft, onRemove: () => void, nested = false) => (
    <div
      key={field.id}
      className={`${styles.item}${field.id === selectedId ? ` ${styles.active}` : ""}${nested ? ` ${styles.nested}` : ""}`}
      onClick={() => onSelect(field.id)}
    >
      <div className={styles.itemMain}>
        <span className={styles.itemTitle}>{field.title || field.key}</span>
        <Tag>{FIELD_TYPE_META[field.type].label}</Tag>
      </div>
      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      />
    </div>
  );

  return (
    <div className={styles.list}>
      {fields.length === 0 ? <Empty description="还没有字段" /> : null}
      {fields.map((field) => (
        <div key={field.id}>
          {renderItem(field, () => removeField(field.id))}
          {isContainerType(field.type) ? (
            <div className={styles.children}>
              {(field.children ?? []).map((child) =>
                renderItem(child, () => removeChild(field, child.id), true),
              )}
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => addChild(field)}
              >
                添加子字段
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addField}>
        添加字段
      </Button>
    </div>
  );
}
