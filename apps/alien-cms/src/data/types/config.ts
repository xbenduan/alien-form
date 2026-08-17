/**
 * Simplified AlienCmsConfig.
 *
 * Only two runtime modes:
 * - local (no baseUrl) → in-memory demo
 * - http  (baseUrl set) → remote REST API via HttpClient
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
  retries?: number;
  headers?: Record<string, string>;
}

export interface AlienCmsConfig {
  version: "1.0";
  name: string;
  description?: string;

  /**
   * Base URL of the remote backend API.
   * If absent, the system runs in local demo mode.
   */
  baseUrl?: string;

  /**
   * Authentication credentials for login.
   * The frontend will POST to `{baseUrl}/api/auth/login` with these.
   */
  auth?: {
    username?: string;
    password?: string;
  };

  /** Adapter config for request/response field mapping. */
  adapter?: AdapterConfig;

  /** Connection-level options (timeout, retries, extra headers). */
  options?: ConnectionOptions;
}
