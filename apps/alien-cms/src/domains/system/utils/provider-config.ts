import type { AlienCmsConfig } from "@alien-form/cms";

export type ProviderType = NonNullable<AlienCmsConfig["provider"]>;

export interface ProviderSettingsFormValues {
  name?: string;
  description?: string;
  provider?: ProviderType;
  options?: {
    timeout?: number;
    retries?: number;
    headersText?: string;
  };
  supabase?: {
    url?: string;
    anonKey?: string;
    tables?: {
      schemas?: string;
      records?: string;
      logs?: string;
    };
  };
  http?: {
    baseUrl?: string;
    endpoints?: {
      schemas?: {
        list?: string;
        detail?: string;
        create?: string;
        update?: string;
        delete?: string;
      };
      records?: {
        list?: string;
        detail?: string;
        create?: string;
        update?: string;
        delete?: string;
        batchDelete?: string;
      };
      logs?: {
        list?: string;
        append?: string;
      };
    };
  };
  tcb?: {
    envId?: string;
    region?: string;
    collections?: {
      schemas?: string;
      records?: string;
      logs?: string;
    };
  };
}

function trimString(value?: string) {
  const next = value?.trim();
  return next ? next : undefined;
}

function maybeObject<T extends Record<string, unknown>>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function parseHeadersText(headersText?: string) {
  const text = headersText?.trim();
  if (!text) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("自定义请求头必须是合法 JSON。");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("自定义请求头必须是 JSON 对象。");
  }

  const normalizedHeaders = Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>(
    (result, [key, value]) => {
      if (value === undefined || value === null || value === "") {
        return result;
      }
      result[key] = String(value);
      return result;
    },
    {},
  );

  return maybeObject(normalizedHeaders);
}

function ensureProviderType(provider?: string): ProviderType {
  if (provider === "supabase" || provider === "http" || provider === "tcb" || provider === "local") {
    return provider;
  }
  throw new Error("仅支持 local、supabase、http、tcb 四种 provider。");
}

function validateConfig(config: AlienCmsConfig) {
  if (config.version !== "1.0") {
    throw new Error("配置文件版本必须为 1.0。");
  }

  const provider = ensureProviderType(config.provider ?? "local");
  if (!trimString(config.name)) {
    throw new Error("配置文件缺少 name。");
  }

  if (provider === "supabase") {
    if (!trimString(config.supabase?.url) || !trimString(config.supabase?.anonKey)) {
      throw new Error("Supabase 配置缺少 url 或 anonKey。");
    }
  }

  if (provider === "http") {
    if (!trimString(config.http?.baseUrl)) {
      throw new Error("HTTP 配置缺少 baseUrl。");
    }
  }

  if (provider === "tcb") {
    if (!trimString(config.tcb?.envId)) {
      throw new Error("TCB 配置缺少 envId。");
    }
  }
}

export function parseProviderConfigText(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("上传文件不是合法 JSON。");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("上传文件内容必须是 JSON 对象。");
  }

  const config = parsed as AlienCmsConfig;
  validateConfig(config);
  return config;
}

export function createDefaultFormValues(): ProviderSettingsFormValues {
  return {
    name: "Alien CMS",
    description: "",
    provider: "local",
    options: {
      headersText: "",
    },
  };
}

export function configToFormValues(config?: AlienCmsConfig | null): ProviderSettingsFormValues {
  if (!config) {
    return createDefaultFormValues();
  }

  return {
    name: config.name,
    description: config.description ?? "",
    provider: ensureProviderType(config.provider ?? "local"),
    options: {
      timeout: config.options?.timeout,
      retries: config.options?.retries,
      headersText: config.options?.headers
        ? JSON.stringify(config.options.headers, null, 2)
        : "",
    },
    supabase: {
      url: config.supabase?.url,
      anonKey: config.supabase?.anonKey,
      tables: {
        schemas: config.supabase?.tables?.schemas,
        records: config.supabase?.tables?.records,
        logs: config.supabase?.tables?.logs,
      },
    },
    http: {
      baseUrl: config.http?.baseUrl,
      endpoints: {
        schemas: {
          list: config.http?.endpoints?.schemas?.list,
          detail: config.http?.endpoints?.schemas?.detail,
          create: config.http?.endpoints?.schemas?.create,
          update: config.http?.endpoints?.schemas?.update,
          delete: config.http?.endpoints?.schemas?.delete,
        },
        records: {
          list: config.http?.endpoints?.records?.list,
          detail: config.http?.endpoints?.records?.detail,
          create: config.http?.endpoints?.records?.create,
          update: config.http?.endpoints?.records?.update,
          delete: config.http?.endpoints?.records?.delete,
          batchDelete: config.http?.endpoints?.records?.batchDelete,
        },
        logs: {
          list: config.http?.endpoints?.logs?.list,
          append: config.http?.endpoints?.logs?.append,
        },
      },
    },
    tcb: {
      envId: config.tcb?.envId,
      region: config.tcb?.region,
      collections: {
        schemas: config.tcb?.collections?.schemas,
        records: config.tcb?.collections?.records,
        logs: config.tcb?.collections?.logs,
      },
    },
  };
}

export function formValuesToConfig(values: ProviderSettingsFormValues): AlienCmsConfig {
  const provider = ensureProviderType(values.provider ?? "local");
  const name = trimString(values.name);

  if (!name) {
    throw new Error("请填写配置名称。");
  }

  const config: AlienCmsConfig = {
    version: "1.0",
    name,
    provider,
  };

  const description = trimString(values.description);
  if (description) {
    config.description = description;
  }

  const options = maybeObject({
    timeout: values.options?.timeout,
    retries: values.options?.retries,
    headers: parseHeadersText(values.options?.headersText),
  });
  if (options) {
    config.options = options;
  }

  if (provider === "supabase") {
    const url = trimString(values.supabase?.url);
    const anonKey = trimString(values.supabase?.anonKey);
    if (!url || !anonKey) {
      throw new Error("请完整填写 Supabase 的 URL 和 anonKey。");
    }

    config.supabase = {
      url,
      anonKey,
      tables: maybeObject({
        schemas: trimString(values.supabase?.tables?.schemas),
        records: trimString(values.supabase?.tables?.records),
        logs: trimString(values.supabase?.tables?.logs),
      }),
    };
  }

  if (provider === "http") {
    const baseUrl = trimString(values.http?.baseUrl);
    if (!baseUrl) {
      throw new Error("请填写 HTTP provider 的 baseUrl。");
    }

    config.http = {
      baseUrl,
      endpoints: maybeObject({
        schemas: maybeObject({
          list: trimString(values.http?.endpoints?.schemas?.list),
          detail: trimString(values.http?.endpoints?.schemas?.detail),
          create: trimString(values.http?.endpoints?.schemas?.create),
          update: trimString(values.http?.endpoints?.schemas?.update),
          delete: trimString(values.http?.endpoints?.schemas?.delete),
        }),
        records: maybeObject({
          list: trimString(values.http?.endpoints?.records?.list),
          detail: trimString(values.http?.endpoints?.records?.detail),
          create: trimString(values.http?.endpoints?.records?.create),
          update: trimString(values.http?.endpoints?.records?.update),
          delete: trimString(values.http?.endpoints?.records?.delete),
          batchDelete: trimString(values.http?.endpoints?.records?.batchDelete),
        }),
        logs: maybeObject({
          list: trimString(values.http?.endpoints?.logs?.list),
          append: trimString(values.http?.endpoints?.logs?.append),
        }),
      }),
    };
  }

  if (provider === "tcb") {
    const envId = trimString(values.tcb?.envId);
    if (!envId) {
      throw new Error("请填写 TCB provider 的 envId。");
    }

    config.tcb = {
      envId,
      region: trimString(values.tcb?.region),
      collections: maybeObject({
        schemas: trimString(values.tcb?.collections?.schemas),
        records: trimString(values.tcb?.collections?.records),
        logs: trimString(values.tcb?.collections?.logs),
      }),
    };
  }

  return config;
}

export function buildSupabaseTemplate(): AlienCmsConfig {
  return {
    version: "1.0",
    name: "Alien CMS Supabase",
    description: "Supabase provider template",
    provider: "supabase",
    supabase: {
      url: "https://your-project.supabase.co",
      anonKey: "your-anon-key",
      tables: {
        schemas: "alien_cms_schemas",
        records: "alien_cms_records",
        logs: "alien_cms_logs",
      },
    },
    options: {
      timeout: 10000,
      retries: 1,
      headers: {},
    },
  };
}

export function downloadConfigFile(config: AlienCmsConfig, filename = "alien-cms.json") {
  const content = JSON.stringify(config, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
