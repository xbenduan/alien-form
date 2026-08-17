import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogProvider, RecordProvider, SchemaProvider } from "../index";
import {
  getCurrentProviderSnapshot,
  getLogProvider,
  getRecordProvider,
  getSchemaProvider,
  initProvider,
  registerProvider,
  resetProvider,
  switchProvider,
} from "./provider";

const STORAGE_KEY = "alien-cms-provider";

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  } satisfies Storage;
}

function createProviderGroup(label: string) {
  const schema = {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    label,
  } as unknown as SchemaProvider;
  const record = {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    label,
  } as unknown as RecordProvider;
  const log = {
    append: vi.fn(),
    list: vi.fn(),
    label,
  } as unknown as LogProvider;

  return { schema, record, log };
}

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("provider runtime", () => {
  it("restores all providers from a valid cached configuration", () => {
    const remote = createProviderGroup("remote");
    const local = createProviderGroup("local");
    const config = { baseUrl: "https://api.example.com" };
    globalThis.localStorage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ type: "http", config }),
    });
    registerProvider("http", (receivedConfig) => {
      expect(receivedConfig).toEqual(config);
      return remote;
    });

    initProvider(() => local);

    expect(getSchemaProvider()).toBe(remote.schema);
    expect(getRecordProvider()).toBe(remote.record);
    expect(getLogProvider()).toBe(remote.log);
  });

  it("falls back to local providers when cached configuration cannot initialize", () => {
    const local = createProviderGroup("local");
    globalThis.localStorage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ type: "broken", config: { invalid: true } }),
    });
    registerProvider("broken", () => {
      throw new Error("invalid config");
    });

    initProvider(() => local);

    expect(getSchemaProvider()).toBe(local.schema);
    expect(getRecordProvider()).toBe(local.record);
    expect(getLogProvider()).toBe(local.log);
  });

  it("switches provider and persists its configuration", () => {
    const local = createProviderGroup("local");
    const remote = createProviderGroup("remote");
    const config = { baseUrl: "https://api.example.com" };
    globalThis.localStorage = createStorage();
    registerProvider("http", () => remote);
    initProvider(() => local);

    switchProvider("http", config);

    expect(getSchemaProvider()).toBe(remote.schema);
    expect(getRecordProvider()).toBe(remote.record);
    expect(getLogProvider()).toBe(remote.log);
    expect(getCurrentProviderSnapshot()).toEqual({ type: "http", config });
  });

  it("resets all providers to local and clears the cache", () => {
    const local = createProviderGroup("local");
    const remote = createProviderGroup("remote");
    globalThis.localStorage = createStorage();
    registerProvider("http", () => remote);
    initProvider(() => local);
    switchProvider("http", { baseUrl: "https://api.example.com" });

    resetProvider();

    expect(getSchemaProvider()).toBe(local.schema);
    expect(getRecordProvider()).toBe(local.record);
    expect(getLogProvider()).toBe(local.log);
    expect(getCurrentProviderSnapshot()).toBeNull();
  });
});
