import { checkAbort, FormworkError } from "./errors";
import { isObject } from "./pointer";
import type { FormworkApis } from "../data/index";
import {
  assertDraftDefinition,
  assertManagedSnapshot,
  assertPreviewSnapshot,
  assertPublishedSnapshot,
  assertRuntimeSnapshot,
  managedEntrySchema,
  modelIdPattern,
  modelNavigationSchema,
  validationReportSchema,
} from "./schema";
import type {
  ActorSummary,
  CredentialEntry,
  DraftDefinition,
  EffectiveCapabilities,
  ManagedEntry,
  ManagedSnapshot,
  ModelNavigationSnapshot,
  PreviewSnapshot,
  PublishedSnapshot,
  ReadOptions,
  RuntimeSnapshot,
  RouteTarget,
  ValidationReport,
  WriteOptions,
} from "./types";

type HttpRecords = {
  [K in keyof Required<FormworkApis["records"]>]: (
    input: Parameters<Required<FormworkApis["records"]>[K]>[0],
    options?: ReadOptions,
  ) => ReturnType<Required<FormworkApis["records"]>[K]>;
};
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
  navigation: {
    read: (options?: ReadOptions) => Promise<ModelNavigationSnapshot>;
    pinModel: (id: string, options?: ReadOptions) => Promise<ModelNavigationSnapshot>;
    unpinModel: (id: string, options?: ReadOptions) => Promise<ModelNavigationSnapshot>;
  };
  models: {
    list: (options?: ReadOptions) => Promise<ManagedEntry[]>;
    read: (id: string, options?: ReadOptions) => Promise<ManagedSnapshot>;
    saveDraft: (id: string, definition: unknown, options: WriteOptions) => Promise<ManagedSnapshot>;
    validate: (
      id: string,
      definition: unknown,
      target?: string | RouteTarget,
      options?: ReadOptions,
    ) => Promise<ValidationReport>;
    publish: (id: string, ifRevision: string, options?: ReadOptions) => Promise<PublishedSnapshot>;
    versions: (id: string, options?: ReadOptions) => Promise<PublishedSnapshot[]>;
    version: (id: string, version: number, options?: ReadOptions) => Promise<PublishedSnapshot>;
    preview: (
      id: string,
      target: string | RouteTarget,
      options?: ReadOptions,
    ) => Promise<{
      modelId: string;
      router: string;
      revision: string;
      url: string;
    }>;
    draftSchema: (id: string, revision: string, options?: ReadOptions) => Promise<PreviewSnapshot>;
  };
  runtime: { schema: (id: string, options?: ReadOptions) => Promise<RuntimeSnapshot> };
  capabilities: (
    id: string,
    target: string | RouteTarget,
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
  records: HttpRecords;
};

/** 通过带 Bearer 的统一 HTTP 协议访问 Worker；不会重试 CAS 写入。 */
export function createFormworkApi(options: FormworkApiOptions): FormworkApi {
  const targetParams = (target: string | RouteTarget) => {
    const reference = typeof target === "string" ? { router: target } : target;
    return {
      router: reference.router,
    };
  };
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
      if (response.status === 401 && token === options.token?.()) options.onUnauthorized?.();
      throw new FormworkError("HTTP_ERROR", `HTTP ${response.status}: 返回内容不是 JSON`);
    }
    if (!response.ok) {
      if (response.status === 401 && token === options.token?.()) options.onUnauthorized?.();
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
    navigation: {
      async read(settings) {
        return modelNavigationSchema.parse(
          await request("/navigation", "GET", undefined, settings),
        );
      },
      async pinModel(id, settings) {
        return modelNavigationSchema.parse(
          await request(modelPath(id, "/navigation/pins"), "PUT", undefined, settings),
        );
      },
      async unpinModel(id, settings) {
        return modelNavigationSchema.parse(
          await request(modelPath(id, "/navigation/pins"), "DELETE", undefined, settings),
        );
      },
    },
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
      async validate(id, definition, target, settings) {
        const reference = target === undefined ? undefined : targetParams(target);
        return validationReportSchema.parse(
          await request(
            `${modelPath(id)}/validate`,
            "POST",
            { definition, ...reference },
            settings,
          ),
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
      preview(id, target, settings) {
        const reference = targetParams(target);
        const query = new URLSearchParams(reference);
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
    capabilities: (id, target, settings) =>
      request(
        `/formwork/capabilities?${new URLSearchParams({
          modelId: id,
          ...targetParams(target),
        })}`,
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
      options: ({ modelId, ...input }, settings) =>
        request(`${recordPath(modelId)}/options`, "POST", input, settings),
      query: ({ modelId, query }, settings) =>
        request(`${recordPath(modelId)}/query`, "POST", query, settings),
      get: ({ modelId, recordId }, settings) =>
        request(recordPath(modelId, recordId), "GET", undefined, settings),
      create: ({ modelId, ...input }, settings) =>
        request(recordPath(modelId), "POST", input, settings),
      update: ({ modelId, recordId, ...input }, settings) =>
        request(recordPath(modelId, recordId), "PATCH", input, settings),
      delete: ({ modelId, recordId, ...input }, settings) =>
        request(recordPath(modelId, recordId), "DELETE", input, settings),
    },
  };
}
