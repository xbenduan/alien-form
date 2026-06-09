import type { AlienCmsConfig } from "@alien-form/cms";

export interface ProviderSettingsFormValues {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export function createDefaultFormValues(): ProviderSettingsFormValues {
  return {
    baseUrl: "",
    username: "",
    password: "",
  };
}

export function configToFormValues(config?: AlienCmsConfig | null): ProviderSettingsFormValues {
  if (!config) {
    return createDefaultFormValues();
  }

  return {
    baseUrl: config.baseUrl ?? "",
    username: config.auth?.username ?? "",
    password: config.auth?.password ?? "",
  };
}

export function formValuesToConfig(values: ProviderSettingsFormValues): AlienCmsConfig {
  const baseUrl = values.baseUrl?.trim();

  if (!baseUrl) {
    throw new Error("请填写 API 地址。");
  }

  const config: AlienCmsConfig = {
    version: "1.0",
    name: "Alien CMS",
    baseUrl,
  };

  const username = values.username?.trim();
  const password = values.password?.trim();

  if (username && password) {
    config.auth = { username, password };
  }

  return config;
}
