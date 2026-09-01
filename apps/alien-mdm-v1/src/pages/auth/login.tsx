import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers";

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  if (auth.authenticated) return <Navigate to="/" replace />;

  const submit = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(undefined);
    try {
      await auth.login(values.username, values.password);
      const target = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(target, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <Typography.Title level={2}>Alien MDM</Typography.Title>
        <Typography.Paragraph type="secondary">登录主数据管理工作台</Typography.Paragraph>
        {error && <Alert type="error" message={error} showIcon />}
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="username" label="账号" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form>
      </section>
    </main>
  );
}
