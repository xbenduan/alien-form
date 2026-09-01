import { DatabaseOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, List, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";

export default function HomePage() {
  const [models, setModels] = useState<ModelSummary[]>();
  useEffect(() => {
    void transport.send<ModelSummary[]>("/api/schemas").then(setModels);
  }, []);

  return (
    <section>
      <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
        <div>
          <Typography.Title level={3}>工作台</Typography.Title>
          <Typography.Text type="secondary">选择模型开始管理记录</Typography.Text>
        </div>
        <Link to="/models/add">
          <Button type="primary" icon={<PlusOutlined />}>
            新建模型
          </Button>
        </Link>
      </Flex>
      {!models ? (
        <Skeleton active />
      ) : models.length ? (
        <List
          bordered
          dataSource={models}
          renderItem={(model) => (
            <List.Item
              actions={[
                <Link key="records" to={`/records/${model.name}/list`}>
                  打开记录
                </Link>,
              ]}
            >
              <List.Item.Meta
                avatar={<DatabaseOutlined />}
                title={model.title}
                description={`${model.name} · ${model.fieldCount} 个字段`}
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty description="尚未创建模型" />
      )}
    </section>
  );
}
