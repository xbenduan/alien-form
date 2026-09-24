import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Input, Typography } from "antd";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../app/providers";

export default function LoginPage() {
  const auth = useAuth();
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
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,rgba(22,119,255,0.08),rgba(21,121,88,0.08)),#f5f7fb]">
      <section
        className="w-[min(420px,calc(100vw-40px))] rounded-lg border border-[#e0e7f0] bg-white p-[34px] shadow-[0_18px_44px_rgba(30,65,110,0.12)] max-[520px]:p-6"
        aria-label="登录"
      >
        <div className="mb-7 flex items-center gap-3.5">
          <div className="grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-[7px]">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </div>
          <div>
            <Typography.Text className="text-xs font-bold tracking-[1.2px] text-[#1677ff]">
              ALIEN MDM
            </Typography.Text>
            <Typography.Title
              level={3}
              className="!m-0 text-[#172033]"
            >
              登录工作台
            </Typography.Title>
          </div>
        </div>
        <form
          className="[&_.ant-input-affix-wrapper]:rounded-md"
          onSubmit={submit}
        >
          <div className="mb-6">
            <label
              className="mb-2 inline-flex text-sm leading-[22px] text-[#262626]"
              htmlFor="login-username"
            >
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
          <div className="mb-6">
            <label
              className="mb-2 inline-flex text-sm leading-[22px] text-[#262626]"
              htmlFor="login-password"
            >
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
