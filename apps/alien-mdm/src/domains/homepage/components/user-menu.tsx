import { useNavigate } from "react-router-dom";
import { App, Dropdown } from "antd";
import { LogoutOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";
import { loginPath, modelListPath, recordEditPath } from "../../../app/router/paths";
import { useAuth } from "../../auth/components/auth-provider";
import { Identicon } from "./identicon";
import styles from "./index.module.css";

const USER_MODEL = "school-user";

/** 顶栏用户头像：hover 展开模型管理、个人信息和退出登录入口。 */
export function UserMenu() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { message } = App.useApp();
  const user = auth.user;

  async function handleLogout() {
    try {
      await auth.logout();
      navigate(loginPath(), { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "退出登录失败");
    }
  }

  return (
    <Dropdown
      trigger={["hover"]}
      placement="bottomRight"
      menu={{
        items: [
          {
            key: "models",
            icon: <SettingOutlined />,
            label: "模型管理",
            onClick: () => navigate(modelListPath()),
          },
          {
            key: "profile",
            icon: <UserOutlined />,
            label: user?.displayName ? `个人信息：${user.displayName}` : "个人信息",
            onClick: () => {
              if (user?.id) navigate(recordEditPath(USER_MODEL, user.id));
            },
          },
          {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "退出登录",
            onClick: handleLogout,
          },
        ],
      }}
    >
      <button
        type="button"
        className={`${styles.userMenu} ${styles.trigger}`}
        aria-label="用户菜单"
      >
        <Identicon seed={user?.id ?? "anonymous"} />
      </button>
    </Dropdown>
  );
}
