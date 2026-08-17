import type { AdapterConfig } from "../../types/config";

declare const URL: new (path: string, base?: string) => {
  searchParams: { set(key: string, value: string): void };
  toString(): string;
};
declare const AbortController: new () => { signal: unknown; abort(): void };
declare const fetch: (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: unknown;
}) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}>;
declare function setTimeout(callback: () => void, delay: number): unknown;
declare function clearTimeout(handle: unknown): void;

export interface HttpClientOptions {
  /** Base URL of the remote API. */
  baseUrl: string;
  /** Adapter config for request/response mapping. */
  adapter?: AdapterConfig;
  /** Default request headers (includes Authorization if already logged in). */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeout?: number;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(base: string, path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * HTTP client for generic REST API communication.
 * Zero external dependencies — uses native fetch.
 *
 * Token is passed via `headers` option (set at construction time after login).
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly adapter?: AdapterConfig;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.adapter = options.adapter;
    this.defaultHeaders = options.headers ?? {};
    this.timeout = options.timeout ?? 10000;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;
    const url = buildUrl(this.baseUrl, path, params);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract list data from response using adapter config.
   */
  extractList<T>(responseData: any): { list: T[]; total: number } {
    const listConfig = this.adapter?.response?.list;
    const dataPath = listConfig?.dataPath ?? "data.list";
    const totalPath = listConfig?.totalPath ?? "data.total";

    return {
      list: getByPath(responseData, dataPath) ?? [],
      total: getByPath(responseData, totalPath) ?? 0,
    };
  }

  /**
   * Extract detail data from response using adapter config.
   */
  extractDetail<T>(responseData: any): T {
    const detailConfig = this.adapter?.response?.detail;
    const dataPath = detailConfig?.dataPath ?? "data";
    return getByPath(responseData, dataPath);
  }

  /**
   * Build list request params using adapter config.
   */
  buildListParams(options: {
    pagination?: { current: number; pageSize: number };
    sorter?: { field?: string; order?: "ascend" | "descend" };
    filters?: object;
    keyword?: string;
  }): Record<string, string | number | boolean | undefined> {
    const listConfig = this.adapter?.request?.list;
    const paginationConfig = listConfig?.pagination;
    const sorterConfig = listConfig?.sorter;
    const params: Record<string, any> = {};

    // Pagination
    if (options.pagination) {
      const currentKey = paginationConfig?.currentKey ?? "current";
      const pageSizeKey = paginationConfig?.pageSizeKey ?? "pageSize";

      if (paginationConfig?.strategy === "offset") {
        params[currentKey] = (options.pagination.current - 1) * options.pagination.pageSize;
      } else {
        params[currentKey] = options.pagination.current;
      }
      params[pageSizeKey] = options.pagination.pageSize;
    }

    // Sorter
    if (options.sorter?.field) {
      const fieldKey = sorterConfig?.fieldKey ?? "sortField";
      const orderKey = sorterConfig?.orderKey ?? "sortOrder";
      const ascValue = sorterConfig?.ascValue ?? "asc";
      const descValue = sorterConfig?.descValue ?? "desc";

      params[fieldKey] = options.sorter.field;
      params[orderKey] = options.sorter.order === "descend" ? descValue : ascValue;
    }

    // Keyword
    if (options.keyword) {
      params.keyword = options.keyword;
    }

    // Flat filters
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null && value !== "") {
          params[key] = value;
        }
      }
    }

    return params;
  }
}
