import type { ModelSummary } from "@alien-form/cms";
import { Card, Divider, Menu, Typography } from "../../../shared/ui";
import { useNavigate } from "react-router-dom";
import { getMenuRoutes } from "../../router/routes";
import { buildRecordPath } from "../../router/paths";

interface WorkbenchSidebarProps {
  modelSummaries: ModelSummary[];
  activeKey?: string;
}

export function WorkbenchSidebar({ modelSummaries, activeKey }: WorkbenchSidebarProps) {
  const navigate = useNavigate();

  // Auto-generate system menu items from route definitions
  const systemMenuRoutes = getMenuRoutes("system");
  const systemMenuItems = systemMenuRoutes.map((route) => ({
    key: route.key,
    icon: route.menu!.icon,
    label: route.menu!.label,
  }));

  // Model list menu items (dynamic from model summaries)
  const modelMenuItems = modelSummaries.map((item) => ({
    key: item.name,
    label: item.title,
  }));

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
        <Divider className="model-side-panel-divider" titlePlacement="left">
          系统菜单
        </Divider>
        <Menu
          mode="inline"
          selectedKeys={systemMenuItems.some((item) => item.key === activeKey) ? [activeKey!] : []}
          items={systemMenuItems}
          onClick={({ key }) => {
            const route = systemMenuRoutes.find((r) => r.key === key);
            if (route) {
              navigate(`/${route.path}`);
            }
          }}
        />
      </div>

      <div className="model-side-panel-menu-block">
        <Divider className="model-side-panel-divider" titlePlacement="left">
          模型列表
        </Divider>
        <Menu
          mode="inline"
          selectedKeys={
            activeKey && !systemMenuItems.some((item) => item.key === activeKey)
              ? [activeKey]
              : []
          }
          items={modelMenuItems}
          onClick={({ key }) => navigate(buildRecordPath(String(key)))}
        />
      </div>
    </Card>
  );
}
