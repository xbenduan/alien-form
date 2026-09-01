import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Popconfirm, Table, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { FieldSchema } from "@engine";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";
import { schemaToColumns } from "@utils/schema";

const modelMeta: FieldSchema = {
  type: "object",
  properties: {
    title: { type: "string", title: "模型名称", "x-table": { filterable: true } },
    name: { type: "string", title: "模型编码", "x-table": { filterable: true } },
    group: { type: "string", title: "分组", "x-table": { filterable: true } },
    fieldCount: { type: "number", title: "字段数", "x-table": { width: 100 } },
    updatedAt: { type: "string", title: "更新时间", "x-table": { width: 190 } },
  },
};

export default function ModelListPage() {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModels(await transport.send<ModelSummary[]>("/api/schemas"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const data = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((model) =>
      [model.name, model.title, model.group].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [keyword, models]);
  const columns = [
    ...schemaToColumns<ModelSummary>(modelMeta),
    {
      title: "操作",
      key: "actions",
      width: 230,
      fixed: "right" as const,
      render: (_: unknown, model: ModelSummary) => (
        <Flex gap={4}>
          <Link to={`/records/${model.name}/list`}>
            <Button type="link">记录</Button>
          </Link>
          <Link to={`/models/${model.name}/edit`}>
            <Button type="text" icon={<EditOutlined />} aria-label="编辑" />
          </Link>
          <Popconfirm
            title="删除模型"
            description="物理数据表将保留，确认移除模型定义？"
            onConfirm={async () => {
              await transport.send(`/api/schemas/${model.name}`, { method: "DELETE" });
              message.success("模型已删除");
              await load();
            }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除" />
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <section>
      <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
        <Typography.Title level={3}>模型管理</Typography.Title>
        <Link to="/models/add">
          <Button type="primary" icon={<PlusOutlined />}>
            新建模型
          </Button>
        </Link>
      </Flex>
      <Flex style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="筛选名称、编码或分组"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 320 }}
        />
      </Flex>
      <Table
        rowKey="name"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 900 }}
      />
    </section>
  );
}
