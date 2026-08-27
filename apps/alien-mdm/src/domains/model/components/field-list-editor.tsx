import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Empty, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useRef, useState } from "react";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import { ModelCodec, type FieldDraft, type ModelDraft } from "../builder";
import { componentAlias, isContainerField } from "../utils";
import { FieldEditor, type FieldEditorRef } from "./field-editor";
import styles from "./index.module.css";

type EditorState =
  | { mode: "add"; parentId?: string; field: FieldDraft }
  | { mode: "edit"; field: FieldDraft }
  | undefined;

interface FieldRow {
  id: string;
  field: FieldDraft;
  path: string;
  level: number;
}

function flattenFields(fields: FieldDraft[], parentPath = "", level = 0): FieldRow[] {
  return fields.flatMap((field) => {
    const key = field.fields.key || "(未命名)";
    const path = parentPath ? `${parentPath}.${key}` : key;
    return [
      { id: field.id, field, path, level },
      ...flattenFields(field.children ?? [], path, level + 1),
    ];
  });
}

function configured(field: FieldDraft): string[] {
  const schema = field.fields;
  const tags: string[] = [];
  if (schema.required) tags.push("必填");
  if (schema.disabled) tags.push("禁用");
  if (schema.display && schema.display !== "visible") tags.push(schema.display);
  if (schema.dataSource) {
    tags.push(
      Array.isArray(schema.dataSource) ? `数据源 ${schema.dataSource.length}` : "数据源插件",
    );
  }
  if (schema.props && Object.keys(schema.props).length)
    tags.push(`props ${Object.keys(schema.props).length}`);
  if (schema["x-validate"]) tags.push("校验");
  if (schema["x-reaction"]) tags.push("联动");
  if (schema["x-effect"]) tags.push("副作用");
  if (schema["x-format"]) tags.push("格式化");
  if (schema["x-table"]) tags.push("表格");
  if (schema["x-database"]) tags.push("存储");
  if (field.children?.length) tags.push(`子项 ${field.children.length}`);
  return tags;
}

function descendantCount(field: FieldDraft): number {
  return (field.children ?? []).reduce((count, child) => count + 1 + descendantCount(child), 0);
}

export function FieldListEditor() {
  const { message } = App.useApp();
  const builder = useBuilder<ModelDraft>();
  const document = useBuilderAtom(builder.document);
  const codec = useRef(new ModelCodec(builder.registry)).current;
  const [editor, setEditor] = useState<EditorState>();
  const [keyword, setKeyword] = useState("");
  const [draggingId, setDraggingId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const fieldEditorRef = useRef<FieldEditorRef>(null);
  const rows = useMemo(() => {
    const all = flattenFields(document.fields);
    const query = keyword.trim().toLowerCase();
    if (!query) return all;
    return all.filter(({ field, path }) =>
      [path, field.fields.key, field.fields.title, field.fields.type, field.fields.component].some(
        (value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
      ),
    );
  }, [document.fields, keyword]);

  const saveField = async () => {
    if (!editor || !fieldEditorRef.current) return;
    try {
      const field = await fieldEditorRef.current.submit();
      builder.dispatch(
        editor.mode === "edit" ? "field.update" : "field.add",
        editor.mode === "edit"
          ? { id: editor.field.id, field }
          : { field, parentId: editor.parentId },
      );
      setEditor(undefined);
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
      return;
    }
  };

  const addField = (parentId?: string) => {
    setEditor({
      mode: "add",
      parentId,
      field: codec.createField("Input", document.name),
    });
  };

  const columns: ColumnsType<FieldRow> = [
    {
      title: "Key",
      dataIndex: "path",
      width: 220,
      fixed: "left",
      render: (path: string, row) => (
        <div className={styles.fieldPath} style={{ paddingInlineStart: row.level * 18 }}>
          <span className={styles.pathBranch}>{row.level ? "└" : ""}</span>
          <Tooltip title={path}>
            <code>{row.field.fields.key}</code>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "标题",
      width: 150,
      render: (_, row) => row.field.fields.title || "-",
    },
    {
      title: "类型",
      width: 100,
      render: (_, row) => <code>{row.field.fields.type}</code>,
    },
    {
      title: "组件",
      width: 130,
      render: (_, row) =>
        componentAlias(builder.registry, row.field.fields.component, builder.domain),
    },
    {
      title: "配置概览",
      render: (_, row) => {
        const tags = configured(row.field);
        return tags.length ? (
          <Space size={[4, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          <span className={styles.muted}>默认配置</span>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 132,
      fixed: "right",
      render: (_, row) => {
        const nested = descendantCount(row.field);
        return (
          <Space size={0}>
            {isContainerField(builder.registry, row.field.fields.component, builder.domain) ? (
              <Tooltip title="新增子项">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label="新增子项"
                  onClick={() => addField(row.id)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label="编辑字段"
                onClick={() => setEditor({ mode: "edit", field: row.field })}
              />
            </Tooltip>
            <Popconfirm
              title={nested ? `将同时删除 ${nested} 个子字段，确认删除吗？` : "确认删除字段吗？"}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => builder.dispatch("field.remove", { id: row.id })}
            >
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除字段"
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.fieldTable}>
      <div className={styles.fieldToolbar}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => addField()}>
          添加字段
        </Button>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索 Key、标题或组件"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      {rows.length || document.fields.length ? (
        <Table<FieldRow>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 900 }}
          rowClassName={(row) => (dropTargetId === row.id ? styles.dropTargetRow : "")}
          onRow={(row) => ({
            draggable: !keyword,
            onDragStart: (event) => {
              event.dataTransfer.effectAllowed = "move";
              setDraggingId(row.id);
            },
            onDragOver: (event) => {
              event.preventDefault();
              setDropTargetId(row.id);
            },
            onDragLeave: () => setDropTargetId(undefined),
            onDrop: (event) => {
              event.preventDefault();
              if (draggingId && draggingId !== row.id) {
                builder.dispatch("field.move", { id: draggingId, targetId: row.id });
              }
              setDraggingId(undefined);
              setDropTargetId(undefined);
            },
            onDragEnd: () => {
              setDraggingId(undefined);
              setDropTargetId(undefined);
            },
          })}
        />
      ) : (
        <Empty description="还没有字段" />
      )}
      <Modal
        centered
        destroyOnHidden
        open={Boolean(editor)}
        title={editor?.mode === "edit" ? "编辑字段" : "新增字段"}
        width={900}
        onCancel={() => setEditor(undefined)}
        onOk={saveField}
        okText={editor?.mode === "edit" ? "保存" : "确认新增"}
        cancelText="取消"
        styles={{ body: { height: "min(680px, calc(100vh - 220px))", overflowY: "auto" } }}
      >
        {editor ? <FieldEditor ref={fieldEditorRef} field={editor.field} /> : null}
      </Modal>
    </div>
  );
}
