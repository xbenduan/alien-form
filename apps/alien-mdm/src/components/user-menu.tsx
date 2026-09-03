import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { App, Dropdown } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers";
import { recordRoute } from "../utils/record-route";
import { Identicon } from "./identicon";
import styles from "./index.module.css";

export function UserMenu() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { message } = App.useApp();
  const userId = String(auth.user?.id ?? "_sys_admin");

  return (
    <Dropdown
      trigger={["hover"]}
      placement="bottomRight"
      menu={{
        items: [
          {
            key: "profile",
            icon: <UserOutlined />,
            label: auth.user?.nickname ? `个人信息：${String(auth.user.nickname)}` : "个人信息",
            onClick: () => navigate(recordRoute("_sys_user", "edit", userId)),
          },
          {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "退出登录",
            onClick: async () => {
              try {
                await auth.logout();
                navigate("/login", { replace: true });
              } catch (reason) {
                message.error(reason instanceof Error ? reason.message : "退出登录失败");
              }
            },
          },
        ],
      }}
    >
      <button type="button" className={styles.userMenu} aria-label="用户菜单">
        <Identicon seed={userId} />
      </button>
    </Dropdown>
  );
}
