import { AppstoreOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Input, Typography } from "antd";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers";
import styles from "./login.module.css";

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("_sys_admin");
  const [password, setPassword] = useState("");

  if (auth.authenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await auth.login(username, password);
      const target = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(target, { replace: true });
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

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
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formItem}>
            <label className={styles.label} htmlFor="login-username">
              登录账号
            </label>
            <Input
              id="login-username"
              required
              prefix={<UserOutlined />}
              placeholder="请输入登录账号"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className={styles.formItem}>
            <label className={styles.label} htmlFor="login-password">
              登录密码
            </label>
            <Input.Password
              id="login-password"
              required
              prefix={<LockOutlined />}
              placeholder="请输入登录密码"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            登录
          </Button>
        </form>
      </section>
    </main>
  );
}
