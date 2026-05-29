import React from "react";
import { Tabs, Card, Typography } from "antd";
import { CreateDemo } from "./demos/create";
import { EditDemo } from "./demos/edit";
import { ViewDemo } from "./demos/view";
import { ReactiveDemo } from "./demos/reactive";

const { Title, Text } = Typography;

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Card>
          <Title level={3}>Alien Form Demo</Title>
          <Text type="secondary" className="mb-6 block">
            基于 atomic signal-per-property 架构，UI 层使用 Antd 承接。
          </Text>
          <Tabs
            defaultActiveKey="create"
            items={[
              { key: "create", label: "新增", children: <CreateDemo /> },
              { key: "edit", label: "编辑", children: <EditDemo /> },
              { key: "view", label: "详情", children: <ViewDemo /> },
              { key: "reactive", label: "联动演示", children: <ReactiveDemo /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};
