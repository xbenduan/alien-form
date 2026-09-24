import { describe, expect, it, vi } from "vitest";
import { AlienClient, AlienError, type AuthStore } from "./index.ts";
import type { ModelRecord } from "./index.ts";

function store(): AuthStore {
  let token: string | null = null;
  let model: ModelRecord | null = null;
  return {
    get token() {
      return token;
    },
    get model() {
      return model;
    },
    save(nextToken, nextModel) {
      token = nextToken;
      model = nextModel;
    },
    clear() {
      token = null;
      model = null;
    },
  };
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ status: "success", msg: "", data }), { status });
}

describe("AlienClient", () => {
  it("uses the API envelope and exposes PocketBase-style collection methods", async () => {
    const fetcher: typeof fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe("https://example.com/api/v1/records/articles");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toBeInstanceOf(Headers);
      expect(JSON.parse(String(init?.body))).toEqual({ title: "Hello" });
      return response({ id: "article-1", title: "Hello" }, 201);
    });
    const client = new AlienClient({ baseUrl: "https://example.com/", fetch: fetcher });

    await expect(client.collection("articles").create({ title: "Hello" })).resolves.toEqual({
      id: "article-1",
      title: "Hello",
    });
  });

  it("authenticates, persists the token and clears it after a rejected request", async () => {
    const authStore = store();
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      calls.push(init ?? {});
      return response({ token: "token-1", user: { id: "u1" }, provider: "password" });
    };
    let requestCount = 0;
    const actualFetcher: typeof fetch = async (url, init) => {
      requestCount += 1;
      if (requestCount === 1) return fetcher(url, init);
      calls.push(init ?? {});
      return new Response(JSON.stringify({ status: "error", msg: "未登录或会话已失效", data: null }), {
        status: 401,
      });
    };
    const client = new AlienClient({
      baseUrl: "https://example.com",
      fetch: actualFetcher,
      authStore,
    });

    await client.auth.authWithPassword("admin", "secret");
    expect(client.auth.token).toBe("token-1");
    expect(calls[0]?.headers).toBeInstanceOf(Headers);
    await expect(client.models.list()).rejects.toMatchObject({ status: 401 });
    expect(client.auth.token).toBeNull();
  });

  it("converts API pagination and sorts into the backend protocol", async () => {
    const fetcher: typeof fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        model: "articles",
        pagination: { current: 2, pageSize: 10 },
        filter: "published = true",
        searchFields: ["title"],
        keyword: "sdk",
        sorter: { field: "createdAt", order: "descend" },
      });
      return response({ list: [], total: 21 });
    });
    const client = new AlienClient({ baseUrl: "https://example.com", fetch: fetcher });

    await expect(
      client.collection("articles").getList(2, 10, {
        filter: "published = true",
        sort: "-createdAt",
        searchFields: ["title"],
        keyword: "sdk",
      }),
    ).resolves.toMatchObject({ page: 2, perPage: 10, totalPages: 3 });
  });

  it("supports model management and keeps a configurable browser storage key", async () => {
    const fetcher: typeof fetch = vi.fn(async (url, init) => {
      expect(url).toBe("https://example.com/api/v1/models/articles");
      expect(init?.method).toBe("PUT");
      return response({ name: "articles", version: 2 });
    });
    const client = new AlienClient({
      baseUrl: "https://example.com/api/v1",
      fetch: fetcher,
      authStorageKey: "alien-mdm-token",
    });

    await expect(client.models.update("articles", { title: "Articles" })).resolves.toEqual({
      name: "articles",
      version: 2,
    });
  });

  it("binds the default fetch to globalThis", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => response({ ok: true }));
    globalThis.fetch = fetchSpy;
    try {
      const client = new AlienClient({ baseUrl: "https://example.com" });
      await expect(client.request("/health")).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
