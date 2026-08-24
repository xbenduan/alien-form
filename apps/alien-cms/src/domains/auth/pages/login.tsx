import { AppstoreOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Typography } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { homePath } from "../../../app/router/paths";
import styles from "./login.module.css";

interface LoginFormValues {
  username: string;
  password: string;
}

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const from = (location.state as LocationState | null)?.from?.pathname ?? homePath();

  if (auth.isAuthenticated) return <Navigate replace to={from} />;

  async function handleFinish(values: LoginFormValues) {
    try {
      await auth.login({ provider: "password", ...values });
      navigate(from, { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.panel} aria-label="登录">
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <AppstoreOutlined />
          </div>
          <div>
            <Typography.Text className={styles.kicker}>ALIEN CMS</Typography.Text>
            <Typography.Title
              level={3}
              className={styles.title}
              style={{ marginTop: 0, marginBottom: 0 }}
            >
              登录工作台
            </Typography.Title>
          </div>
        </div>

        <Form<LoginFormValues>
          layout="vertical"
          className={styles.form}
          initialValues={{ username: "jiaowu" }}
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: "请输入登录账号" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入登录账号" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="登录密码"
            rules={[{ required: true, message: "请输入登录密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入登录密码"
              autoComplete="current-password"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            登录
          </Button>
        </Form>
      </section>
    </main>
  );
}
