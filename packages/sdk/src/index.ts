export interface ModelRecord {
  id: string;
  [key: string]: unknown;
}

export interface ModelSummary {
  name: string;
  title: string;
  version: number;
  system?: boolean;
  fieldCount: number;
  [key: string]: unknown;
}

export interface ListResponse<T = ModelRecord> {
  list: T[];
  total: number;
}

export interface LoginResponse {
  token: string;
  user: ModelRecord;
  provider: string;
}

export interface OptionsResponse {
  options: Array<{ value: string | number; label: string }>;
  total: number;
}

export interface SubtreeResponse<T = ModelRecord> {
  list: T[];
}

export type RecordValues = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_API_PATH = "/api/v1";
const TOKEN_KEY = "alien-form-token";

export interface AuthStore {
  token: string | null;
  model: ModelRecord | null;
  save(token: string, model: ModelRecord): void;
  clear(): void;
}

/** 认证状态存储；浏览器默认持久化，Node/SSR 默认仅保存在当前实例。 */
export class LocalAuthStore implements AuthStore {
  private readonly tokenKey: string;
  private readonly memory = { token: null as string | null, model: null as ModelRecord | null };

  constructor(tokenKey = TOKEN_KEY) {
    this.tokenKey = tokenKey;
  }

  get token(): string | null {
    return this.storage()?.getItem(this.tokenKey) ?? this.memory.token;
  }

  get model(): ModelRecord | null {
    const value = this.storage()?.getItem(`${this.tokenKey}:model`);
    if (!value) return this.memory.model;
    try {
      return JSON.parse(value) as ModelRecord;
    } catch {
      return null;
    }
  }

  save(token: string, model: ModelRecord): void {
    this.memory.token = token;
    this.memory.model = model;
    this.storage()?.setItem(this.tokenKey, token);
    this.storage()?.setItem(`${this.tokenKey}:model`, JSON.stringify(model));
  }

  clear(): void {
    this.memory.token = null;
    this.memory.model = null;
    this.storage()?.removeItem(this.tokenKey);
    this.storage()?.removeItem(`${this.tokenKey}:model`);
  }

  private storage(): Storage | undefined {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  }
}

export class AlienError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown = null,
  ) {
    super(message);
    this.name = "AlienError";
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** 请求超时毫秒数；传 0 表示不设置超时。 */
  timeoutMs?: number;
}

export interface ListOptions {
  filter?: string;
  sort?: string;
  searchFields?: string[];
  keyword?: string;
  parentId?: string | null;
}

export interface PageResult<T = ModelRecord> extends ListResponse<T> {
  page: number;
  perPage: number;
  totalPages: number;
}

export interface CollectionOptions {
  /** 记录 API 使用的模型编码。 */
  model?: string;
}

export interface AlienClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  authStore?: AuthStore;
  /** 默认使用 alien-form-token；可配置为旧客户端使用的 token key。 */
  authStorageKey?: string;
  timeoutMs?: number;
  headers?: HeadersInit;
}

export class CollectionService<T extends ModelRecord = ModelRecord> {
  constructor(
    private readonly client: AlienClient,
    readonly model: string,
  ) {}

  async getList(page = 1, perPage = 30, options: ListOptions = {}): Promise<PageResult<T>> {
    const result = await this.client.request<ListResponse<T>>("/records/list", {
      method: "POST",
      body: {
        model: this.model,
        pagination: { current: page, pageSize: perPage },
        filter: options.filter,
        searchFields: options.searchFields,
        keyword: options.keyword,
        parentId: options.parentId,
        sorter: parseSort(options.sort),
      },
    });
    return {
      ...result,
      page,
      perPage,
      totalPages: Math.ceil(result.total / perPage),
    };
  }

  async getFullList(options: ListOptions & { batch?: number } = {}): Promise<T[]> {
    const { batch = 200, ...listOptions } = options;
    const records: T[] = [];
    let page = 1;
    while (true) {
      const result = await this.getList(page, batch, listOptions);
      records.push(...result.list);
      if (records.length >= result.total || result.list.length === 0) return records;
      page += 1;
    }
  }

  getOne(id: string): Promise<T> {
    return this.client.request<T>(
      `/records/${encodeURIComponent(this.model)}/${encodeURIComponent(id)}`,
    );
  }

  create(body: RecordValues): Promise<T> {
    return this.client.request<T>(`/records/${encodeURIComponent(this.model)}`, {
      method: "POST",
      body,
    });
  }

  update(id: string, body: RecordValues): Promise<T> {
    return this.client.request<T>(
      `/records/${encodeURIComponent(this.model)}/${encodeURIComponent(id)}`,
      { method: "PUT", body },
    );
  }

  delete(id: string): Promise<void> {
    return this.client.request<void>(
      `/records/${encodeURIComponent(this.model)}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }

  deleteMany(ids: string[]): Promise<void> {
    return this.client.request<void>(`/records/${encodeURIComponent(this.model)}/batch-delete`, {
      method: "POST",
      body: { ids },
    });
  }

  getOptions(
    options: {
      valueKey?: string;
      labelKey?: string;
      keyword?: string;
      selectedValues?: Array<string | number>;
      limit?: number;
    } = {},
  ): Promise<OptionsResponse> {
    return this.client.request<OptionsResponse>("/records/options", {
      method: "POST",
      body: { model: this.model, ...options },
    });
  }

  getSubtree(
    options: {
      idField?: string;
      parentField?: string;
      parentValue?: string | null;
    } = {},
  ): Promise<SubtreeResponse<T>> {
    return this.client.request<SubtreeResponse<T>>("/records/subtree", {
      method: "POST",
      body: { model: this.model, ...options },
    });
  }

  execute<R = unknown>(command: string, body: unknown = {}): Promise<R> {
    return this.client.request<R>(
      `/records/${encodeURIComponent(this.model)}/actions/${encodeURIComponent(command)}`,
      { method: "POST", body },
    );
  }
}

export class AlienClient {
  readonly auth: {
    readonly store: AuthStore;
    readonly token: string | null;
    readonly model: ModelRecord | null;
    login(body: RecordValues): Promise<LoginResponse>;
    authWithPassword(username: string, password: string): Promise<LoginResponse>;
    logout(): Promise<void>;
    clear(): void;
  };
  readonly models: {
    list(): Promise<ModelSummary[]>;
    get<T = unknown>(name: string): Promise<T>;
    create<T = unknown>(schema: T): Promise<T>;
    update<T = unknown>(name: string, schema: T): Promise<T>;
    delete(name: string): Promise<void>;
  };
  setUnauthorizedHandler(handler: (() => void) | undefined): void {
    this.onUnauthorized = handler;
  }
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly defaultHeaders?: HeadersInit;
  private onUnauthorized?: () => void;

  constructor(options: AlienClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    // 浏览器原生 fetch 依赖 Window/globalThis 调用上下文，不能直接解构后调用。
    this.fetcher = options.fetch ?? fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = options.headers;
    const store = options.authStore ?? new LocalAuthStore(options.authStorageKey);

    this.auth = {
      store,
      get token() {
        return store.token;
      },
      get model() {
        return store.model;
      },
      login: async (body) => {
        const response = await this.request<LoginResponse>("/auth/login", {
          method: "POST",
          body,
          auth: false,
        });
        store.save(response.token, response.user);
        return response;
      },
      authWithPassword: async (username, password) => {
        return this.auth.login({ provider: "password", username, password });
      },
      logout: async () => {
        try {
          if (store.token) await this.request<void>("/auth/logout", { method: "POST" });
        } finally {
          store.clear();
        }
      },
      clear: () => store.clear(),
    };

    this.models = {
      list: () => this.request<ModelSummary[]>("/models"),
      get: <T = unknown>(name: string) => this.request<T>(`/models/${encodeURIComponent(name)}`),
      create: <T = unknown>(schema: T) =>
        this.request<T>("/models", { method: "POST", body: schema }),
      update: <T = unknown>(name: string, schema: T) =>
        this.request<T>(`/models/${encodeURIComponent(name)}`, {
          method: "PUT",
          body: schema,
        }),
      delete: (name: string) =>
        this.request<void>(`/models/${encodeURIComponent(name)}`, { method: "DELETE" }),
    };
  }

  collection<T extends ModelRecord = ModelRecord>(model: string): CollectionService<T> {
    return new CollectionService<T>(this, model);
  }

  async request<T>(
    path: string,
    options: RequestOptions & { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const { timeoutMs = this.timeoutMs, body, auth = true, signal, headers, ...init } = options;
    const requestHeaders = new Headers(this.defaultHeaders);
    new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
    requestHeaders.set("Accept", "application/json");
    if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (auth && this.auth?.store.token) {
      requestHeaders.set("Authorization", `Bearer ${this.auth.store.token}`);
    }

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        ...init,
        signal,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
    );
    const payload = await readBody(response);
    if (isApiEnvelope(payload)) {
      if (payload.status === "success" && response.ok) return payload.data as T;
      if (response.status === 401) {
        this.auth.store.clear();
        this.onUnauthorized?.();
      }
      throw new AlienError(
        payload.msg || `请求失败（${response.status}）`,
        response.status,
        payload.data,
      );
    }
    if (!response.ok) {
      throw new AlienError(`请求失败（${response.status}）`, response.status, payload);
    }
    return payload as T;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    if (timeoutMs <= 0) return this.fetcher(url, init);
    const controller = new AbortController();
    const externalAbort = () => controller.abort();
    init.signal?.addEventListener("abort", externalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetcher(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !init.signal?.aborted) {
        throw new AlienError("请求超时，请稍后重试", 0);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", externalAbort);
    }
  }
}

export function createClient(options: AlienClientOptions): AlienClient {
  return new AlienClient(options);
}

function normalizeBaseUrl(value: string): string {
  const base = value.replace(/\/+$/, "");
  return base.endsWith(DEFAULT_API_PATH) ? base : `${base}${DEFAULT_API_PATH}`;
}

function isApiEnvelope(value: unknown): value is {
  status: "success" | "error";
  msg: string;
  data: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "data" in value &&
    ((value as { status?: unknown }).status === "success" ||
      (value as { status?: unknown }).status === "error")
  );
}

function parseSort(sort?: string) {
  if (!sort) return undefined;
  const descending = sort.startsWith("-");
  return {
    field: descending ? sort.slice(1) : sort,
    order: descending ? "descend" : "ascend",
  } as const;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default AlienClient;
