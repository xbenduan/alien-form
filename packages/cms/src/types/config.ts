/**
 * alien-cms configuration types.
 * Simplified: only local (demo) and http (remote) modes.
 */

export interface AdapterRequestListConfig {
  pagination?: {
    currentKey?: string;
    pageSizeKey?: string;
    strategy?: "pageNumber" | "offset";
  };
  sorter?: {
    fieldKey?: string;
    orderKey?: string;
    ascValue?: string;
    descValue?: string;
  };
  filters?: {
    strategy?: "flat" | "nested" | "body";
  };
}

export interface AdapterResponseConfig {
  dataPath?: string;
  totalPath?: string;
}

export interface AdapterConfig {
  request?: {
    list?: AdapterRequestListConfig;
  };
  response?: {
    list?: AdapterResponseConfig;
    detail?: Pick<AdapterResponseConfig, "dataPath">;
    create?: Pick<AdapterResponseConfig, "dataPath">;
    update?: Pick<AdapterResponseConfig, "dataPath">;
  };
}

export interface ConnectionOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AlienCmsConfig {
  version: "1.0";
  name: string;
  description?: string;
  /** Server API base URL. When absent, uses local demo mode. */
  baseUrl?: string;
  /** Authentication credentials for the remote server. */
  auth?: {
    username: string;
    password: string;
  };
  /** Adapter config for request/response mapping (advanced). */
  adapter?: AdapterConfig;
  /** Connection options. */
  options?: ConnectionOptions;
}
