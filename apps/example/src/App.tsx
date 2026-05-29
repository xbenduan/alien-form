import React from "react";
import { Tabs, Card, Typography } from "antd";
import { CreateForm } from "./pages/create-form";
import { EditForm } from "./pages/edit-form";
import { ViewForm } from "./pages/view-form";

const { Title } = Typography;

export const App: React.FC = () => {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Card>
          <Title level={3} style={{ marginBottom: 24 }}>
            Alien Form + Antd 示例
          </Title>
          <Tabs
            defaultActiveKey="create"
            items={[
              { key: "create", label: "新增", children: <CreateForm /> },
              { key: "edit", label: "编辑", children: <EditForm /> },
              { key: "view", label: "详情", children: <ViewForm /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};
