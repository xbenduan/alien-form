import { DatabaseOutlined, HomeOutlined, LogoutOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Skeleton, Typography } from "antd";
import { Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "../providers";
import { DynamicPage } from "./dynamic-routes";
import { publicRoutes, staticRoutes } from "./static-routes";

function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  return auth.authenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  );
}

function AppShell() {
  const location = useLocation();
  const auth = useAuth();
  const selected = location.pathname.startsWith("/models")
    ? "models"
    : location.pathname.startsWith("/records")
      ? "models"
      : "home";
  return (
    <Layout className="app-shell">
      <Layout.Sider width={224} theme="light" className="app-sider">
        <Link to="/" className="app-brand">
          Alien MDM
        </Link>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={[
            { key: "home", icon: <HomeOutlined />, label: <Link to="/">工作台</Link> },
            {
              key: "models",
              icon: <DatabaseOutlined />,
              label: <Link to="/models">模型管理</Link>,
            },
          ]}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Typography.Text strong>主数据管理</Typography.Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            aria-label="退出登录"
            onClick={() => void auth.logout()}
          />
        </Layout.Header>
        <Layout.Content className="app-content">
          <Suspense fallback={<Skeleton active />}>
            <Outlet />
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Skeleton active />}>
        <Routes>
          {publicRoutes.map(({ path, component: Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            {staticRoutes.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            <Route path="/records/:modelCode/*" element={<DynamicPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
