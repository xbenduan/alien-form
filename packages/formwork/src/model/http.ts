import { checkAbort, FormworkError } from "./errors";
import { isObject } from "./pointer";
import {
  assertDraftDefinition,
  assertManagedSnapshot,
  assertPreviewSnapshot,
  assertPublishedSnapshot,
  assertRuntimeSnapshot,
  managedEntrySchema,
  modelIdPattern,
  validationReportSchema,
} from "./schema";
import type {
  ActorSummary,
  CredentialEntry,
  DraftDefinition,
  EffectiveCapabilities,
  JsonValue,
  ManagedEntry,
  ManagedSnapshot,
  PreviewSnapshot,
  PublishedSnapshot,
  ReadOptions,
  RecordPage,
  RecordQuery,
  RecordValue,
  RuntimeSnapshot,
  ValidationReport,
  WriteOptions,
} from "./types";

/** 配置唯一的 Worker API client；token getter 在每次请求时读取最新会话。 */
export type FormworkApiOptions = {
  url: string;
  fetch?: typeof fetch;
  token?: () => string | undefined;
  onUnauthorized?: () => void;
};
/** 提供模型管理、发布加载、记录和认证的 HTTP 能力。 */
export type FormworkApi = {
  request: <T>(path: string, method?: string, body?: unknown, options?: ReadOptions) => Promise<T>;
  models: {
    list: (options?: ReadOptions) => Promise<ManagedEntry[]>;
    read: (id: string, options?: ReadOptions) => Promise<ManagedSnapshot>;
    saveDraft: (id: string, definition: unknown, options: WriteOptions) => Promise<ManagedSnapshot>;
    validate: (
      id: string,
      definition: unknown,
      router?: string,
      options?: ReadOptions,
    ) => Promise<ValidationReport>;
    publish: (id: string, ifRevision: string, options?: ReadOptions) => Promise<PublishedSnapshot>;
    versions: (id: string, options?: ReadOptions) => Promise<PublishedSnapshot[]>;
    version: (id: string, version: number, options?: ReadOptions) => Promise<PublishedSnapshot>;
    preview: (
      id: string,
      router: string,
      params?: Record<string, string>,
      options?: ReadOptions,
    ) => Promise<{ modelId: string; router: string; revision: string; url: string }>;
    draftSchema: (id: string, revision: string, options?: ReadOptions) => Promise<PreviewSnapshot>;
  };
  runtime: { schema: (id: string, options?: ReadOptions) => Promise<RuntimeSnapshot> };
  capabilities: (
    id: string,
    router: string,
    options?: ReadOptions,
  ) => Promise<EffectiveCapabilities>;
  auth: {
    login: (
      username: string,
      password: string,
      options?: ReadOptions,
    ) => Promise<{ token: string; user: ActorSummary }>;
    me: (options?: ReadOptions) => Promise<ActorSummary>;
    logout: (options?: ReadOptions) => Promise<{ loggedOut: true }>;
    tokens: (options?: ReadOptions) => Promise<CredentialEntry[]>;
    issueToken: (
      input: { label: string; kind?: "agent" | "deploy"; expiresInDays: number },
      options?: ReadOptions,
    ) => Promise<CredentialEntry & { token: string }>;
    revokeToken: (id: string, options?: ReadOptions) => Promise<{ revoked: true }>;
  };
  records: {
    query: (id: string, query: RecordQuery, options?: ReadOptions) => Promise<RecordPage>;
    read: (id: string, recordId: string, options?: ReadOptions) => Promise<RecordValue>;
    create: (id: string, value: RecordValue, options?: ReadOptions) => Promise<RecordValue>;
    update: (
      id: string,
      recordId: string,
      value: RecordValue,
      options?: ReadOptions,
    ) => Promise<RecordValue>;
    delete: (id: string, recordId: string, options?: ReadOptions) => Promise<{ deleted: true }>;
    command: (
      id: string,
      command: string,
      value: JsonValue,
      options?: ReadOptions,
    ) => Promise<JsonValue>;
  };
};

/** 通过带 Bearer 的统一 HTTP 协议访问 Worker；不会重试 CAS 写入。 */
export function createFormworkApi(options: FormworkApiOptions): FormworkApi {
  const request: FormworkApi["request"] = async (path, method = "GET", body, settings) => {
    checkAbort(settings?.signal);
    const token = options.token?.();
    const response = await (options.fetch ?? fetch)(`${options.url.replace(/\/$/u, "")}${path}`, {
      method,
      signal: settings?.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      if (response.status === 401) options.onUnauthorized?.();
      throw new FormworkError("HTTP_ERROR", `HTTP ${response.status}: 返回内容不是 JSON`);
    }
    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      const error = isObject(result) && isObject(result.error) ? result.error : {};
      throw new FormworkError(
        String(error.code ?? "HTTP_ERROR"),
        String(error.message ?? `HTTP ${response.status}`),
        Array.isArray(error.issues) ? error.issues : [],
        typeof error.currentRevision === "string" ? error.currentRevision : undefined,
      );
    }
    return result as never;
  };
  const modelPath = (id: string, prefix = "/models") => {
    if (!modelIdPattern.test(id)) throw new FormworkError("INVALID_INPUT", `无效 modelId ${id}`);
    return `${prefix}/${encodeURIComponent(id)}`;
  };
  const recordPath = (id: string, recordId?: string) => {
    if (recordId === "") throw new FormworkError("INVALID_INPUT", "recordId 不能为空");
    return `${modelPath(id, "/records")}${recordId === undefined ? "" : `/${encodeURIComponent(recordId)}`}`;
  };
  return {
    request,
    models: {
      async list(settings) {
        return managedEntrySchema
          .array()
          .parse(await request("/models", "GET", undefined, settings));
      },
      async read(id, settings) {
        return assertManagedSnapshot(await request(modelPath(id), "GET", undefined, settings), id);
      },
      async saveDraft(id, input, settings) {
        const definition: DraftDefinition = assertDraftDefinition(input, id);
        return assertManagedSnapshot(
          await request(
            `${modelPath(id)}/draft`,
            "PUT",
            { definition, ifRevision: settings.ifRevision },
            settings,
          ),
          id,
        );
      },
      async validate(id, definition, router, settings) {
        return validationReportSchema.parse(
          await request(`${modelPath(id)}/validate`, "POST", { definition, router }, settings),
        );
      },
      async publish(id, ifRevision, settings) {
        return assertPublishedSnapshot(
          await request(`${modelPath(id)}/publish`, "POST", { ifRevision }, settings),
          id,
        );
      },
      async versions(id, settings) {
        const result = await request<unknown[]>(
          `${modelPath(id)}/versions`,
          "GET",
          undefined,
          settings,
        );
        if (!Array.isArray(result)) throw new FormworkError("HTTP_ERROR", "版本目录必须是数组");
        return result.map((item) => assertPublishedSnapshot(item, id));
      },
      async version(id, version, settings) {
        if (!Number.isSafeInteger(version) || version < 1)
          throw new FormworkError("INVALID_INPUT", "version 必须是正整数");
        return assertPublishedSnapshot(
          await request(`${modelPath(id)}/versions/${version}`, "GET", undefined, settings),
          id,
        );
      },
      preview(id, router, params, settings) {
        const query = new URLSearchParams({ router, params: JSON.stringify(params ?? {}) });
        return request(`${modelPath(id)}/preview?${query}`, "GET", undefined, settings);
      },
      async draftSchema(id, revision, settings) {
        return assertPreviewSnapshot(
          await request(
            `${modelPath(id)}/draft-schema?${new URLSearchParams({ revision })}`,
            "GET",
            undefined,
            settings,
          ),
          id,
        );
      },
    },
    runtime: {
      async schema(id, settings) {
        return assertRuntimeSnapshot(
          await request(`${modelPath(id, "/runtime/models")}/schema`, "GET", undefined, settings),
          id,
        );
      },
    },
    capabilities: (id, router, settings) =>
      request(
        `/formwork/capabilities?${new URLSearchParams({ modelId: id, router })}`,
        "GET",
        undefined,
        settings,
      ),
    auth: {
      login: (username, password, settings) =>
        request("/auth/login", "POST", { username, password }, settings),
      me: (settings) => request("/auth/me", "GET", undefined, settings),
      logout: (settings) => request("/auth/logout", "POST", {}, settings),
      tokens: (settings) => request("/auth/tokens", "GET", undefined, settings),
      issueToken: (input, settings) => request("/auth/tokens", "POST", input, settings),
      revokeToken: (id, settings) =>
        request(`/auth/tokens/${encodeURIComponent(id)}`, "DELETE", undefined, settings),
    },
    records: {
      query: (id, query, settings) => request(`${recordPath(id)}/query`, "POST", query, settings),
      read: (id, recordId, settings) =>
        request(recordPath(id, recordId), "GET", undefined, settings),
      create: (id, value, settings) => request(recordPath(id), "POST", value, settings),
      update: (id, recordId, value, settings) =>
        request(recordPath(id, recordId), "PUT", value, settings),
      delete: (id, recordId, settings) =>
        request(recordPath(id, recordId), "DELETE", undefined, settings),
      command: (id, command, value, settings) =>
        request(
          `${recordPath(id)}/commands/${encodeURIComponent(command)}`,
          "POST",
          value,
          settings,
        ),
    },
  };
}
