import type { ModelSummary } from "@alien-form/cms";
import { AppstoreOutlined } from "@ant-design/icons";
import { Card, Divider, Menu, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { buildModelListPath, buildRecordPath } from "../../router/paths";

interface WorkbenchSidebarProps {
  modelSummaries: ModelSummary[];
  activeKey?: string;
}

export function WorkbenchSidebar({ modelSummaries, activeKey }: WorkbenchSidebarProps) {
  const navigate = useNavigate();

  return (
    <Card className="model-side-panel" styles={{ body: { padding: 20 } }}>
      <div className="model-side-panel-top">
        <div className="model-side-panel-title">Alien CMS</div>
        <Typography.Paragraph
          className="model-side-panel-description"
          type="secondary"
          ellipsis={{ rows: 2, tooltip: "基于 schema 驱动的内容模型管理与记录工作台。" }}
        >
          基于 schema 驱动的内容模型管理与记录工作台。
        </Typography.Paragraph>
      </div>

      <div className="model-side-panel-menu-block">
        <Divider className="model-side-panel-divider" titlePlacement="start">
          系统菜单
        </Divider>
        <Menu
          mode="inline"
          selectedKeys={activeKey === "models" ? ["models"] : []}
          items={[
            {
              key: "models",
              icon: <AppstoreOutlined />,
              label: "模型管理",
            },
          ]}
          onClick={({ key }) => {
            if (key === "models") {
              navigate(buildModelListPath());
            }
          }}
        />
      </div>

      <div className="model-side-panel-menu-block">
        <Divider className="model-side-panel-divider" titlePlacement="start">
          模型列表
        </Divider>
        <Menu
          mode="inline"
          selectedKeys={activeKey && activeKey !== "models" ? [activeKey] : []}
          items={modelSummaries.map((item) => ({
            key: item.name,
            label: item.title,
          }))}
          onClick={({ key }) => navigate(buildRecordPath(String(key)))}
        />
      </div>
    </Card>
  );
}
