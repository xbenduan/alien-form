import { useNavigate } from "react-router-dom";
import { Dropdown } from "antd";
import { LogoutOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";
import { modelListPath, recordEditPath } from "../../../app/router/paths";
import { Identicon } from "./Identicon";
import styles from "./index.module.css";

/** 演示用当前用户，写死一个用户记录 id 用于跳转个人信息编辑页。 */
const CURRENT_USER_MODEL = "school-user";
const CURRENT_USER_ID = "user-admin-1";

/** 顶栏用户头像：hover 展开「模型管理」和「个人信息」两个入口。 */
export function UserMenu() {
  const navigate = useNavigate();

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
            label: "个人信息",
            onClick: () => navigate(recordEditPath(CURRENT_USER_MODEL, CURRENT_USER_ID)),
          },
          {
            key: "outing",
            icon: <LogoutOutlined />,
            label: "退出登录",
            disabled: true,
          },
        ],
      }}
    >
      <button
        type="button"
        className={`${styles.userMenu} ${styles.trigger}`}
        aria-label="用户菜单"
      >
        <Identicon seed={CURRENT_USER_ID} />
      </button>
    </Dropdown>
  );
}
