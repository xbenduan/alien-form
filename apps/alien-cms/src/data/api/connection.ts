import { switchProvider } from "../internal/provider";
import { createProviders } from "../provider/create-providers";
import type { AlienCmsConfig } from "../types/config";

async function loginAndGetToken(
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`登录失败 (${response.status}): ${text}`);
  }

  const data = await response.json();
  const token = data?.data?.token ?? data?.token;
  if (!token) {
    throw new Error("登录响应中未找到 token。");
  }
  return token;
}

export async function connectProvider(config: AlienCmsConfig): Promise<AlienCmsConfig> {
  if (!config.baseUrl) {
    throw new Error("远程 Provider 缺少 API 地址。");
  }

  const token =
    config.auth?.username && config.auth.password
      ? await loginAndGetToken(config.baseUrl, config.auth.username, config.auth.password)
      : undefined;
  const connectedConfig: AlienCmsConfig = {
    ...config,
    options: {
      ...config.options,
      headers: token ? { Authorization: `Bearer ${token}` } : config.options?.headers,
    },
  };
  const providers = createProviders(connectedConfig);
  const healthResult = await providers.healthCheck();
  if (!healthResult.ok) {
    throw new Error(healthResult.message ?? "服务连接失败");
  }

  try {
    await providers.schemaProvider.list({
      pagination: { current: 1, pageSize: 1 },
    });
  } catch (error) {
    throw new Error(
      `服务已连通，但 Schemas 接口不可访问：${error instanceof Error ? error.message : "未知错误"}`,
    );
  }

  switchProvider("http", connectedConfig);
  return connectedConfig;
}
