import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Input, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import type { Runtime } from "@alien-form/engine";
import { createField, type FieldNode, type ModelAction, type ModelDraft } from "../builder";
import { StorageFieldModal } from "./storage-field-modal";

interface EditorState {
  node?: FieldNode;
}

export function DatabaseBuilder({
  draft,
  runtime,
  dispatch,
}: {
  draft: ModelDraft;
  runtime: Runtime;
  dispatch: (action: ModelAction) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [editor, setEditor] = useState<EditorState>();

  // 数据库构建只展示落库的顶层字段。
  const dbFields = useMemo(
    () => draft.fields.filter((node) => node.source === "field"),
    [draft.fields],
  );
  const rows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return dbFields;
    return dbFields.filter((node) =>
      [node.key, node.storage?.title].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [dbFields, keyword]);

  const existingKeys = useMemo(() => draft.fields.map((node) => node.key), [draft.fields]);

  const addField = () => setEditor({ node: createField(runtime, { source: "field" }) });

  const columns: ColumnsType<FieldNode> = [
    {
      title: "Key",
      dataIndex: "key",
      width: 180,
      fixed: "left",
      render: (_value, row) => (
        <Space size={4}>
          <Typography.Text code>{row.key}</Typography.Text>
          {row.storage?.system ? <Tag color="gold">系统</Tag> : null}
        </Space>
      ),
    },
    { title: "名称", width: 140, render: (_v, row) => row.storage?.title || "—" },
    {
      title: "存储类型",
      width: 100,
      render: (_v, row) => <Typography.Text code>{row.storage?.type}</Typography.Text>,
    },
    { title: "值类型", width: 90, render: (_v, row) => row.type },
    {
      title: "约束",
      render: (_v, row) => {
        const tags: string[] = [];
        if (row.storage?.nullable === false) tags.push("必填");
        if (row.storage?.unique) tags.push("唯一");
        if (row.storage?.index) tags.push("索引");
        if (row.storage?.filterable) tags.push("可筛选");
        if (row.storage?.visible === false) tags.push("列表隐藏");
        return tags.length ? (
          <Space size={[4, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          <Tag>默认</Tag>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_v, row) => (
        <Space size={0} wrap>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            aria-label="编辑字段"
            onClick={() => setEditor({ node: row })}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该字段？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={row.storage?.system}
            onConfirm={() => dispatch({ type: "field.remove", id: row.id })}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除字段"
              disabled={row.storage?.system}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      variant="outlined"
      styles={{ body: { display: "flex", flexDirection: "column", gap: "16px" } }}
    >
      <Flex justify="space-between">
        <Input
          allowClear
          style={{ width: 340 }}
          prefix={<SearchOutlined />}
          placeholder="搜索字段 Key 或名称"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={addField}>
          新增字段
        </Button>
      </Flex>
      <Table<FieldNode>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 760 }}
        expandable={{ childrenColumnName: "__no_children__" }}
      />
      <StorageFieldModal
        open={Boolean(editor)}
        node={editor?.node}
        existingKeys={existingKeys}
        onCancel={() => setEditor(undefined)}
        onSubmit={(node) => {
          const exists = draft.fields.some((item) => item.id === node.id);
          dispatch(
            exists ? { type: "field.update", id: node.id, node } : { type: "field.add", node },
          );
          setEditor(undefined);
        }}
      />
    </Card>
  );
}
