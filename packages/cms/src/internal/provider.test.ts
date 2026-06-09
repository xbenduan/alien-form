import { afterEach, describe, expect, it } from "vitest";
import { getCurrentProviderSnapshot } from "./provider";

const STORAGE_KEY = "alien-cms-provider";

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("getCurrentProviderSnapshot", () => {
  it("returns null when cache is missing", () => {
    (globalThis as { localStorage?: Storage }).localStorage = createStorage() as Storage;

    expect(getCurrentProviderSnapshot()).toBeNull();
  });

  it("returns the cached provider snapshot when cache is valid", () => {
    (globalThis as { localStorage?: Storage }).localStorage = createStorage({
      [STORAGE_KEY]: JSON.stringify({
        type: "http",
        config: {
          version: "1.0",
          name: "Alien CMS",
          baseUrl: "https://api.example.com",
        },
      }),
    }) as Storage;

    expect(getCurrentProviderSnapshot()).toEqual({
      type: "http",
      config: {
        version: "1.0",
        name: "Alien CMS",
        baseUrl: "https://api.example.com",
      },
    });
  });

  it("returns null when cache contains invalid json", () => {
    (globalThis as { localStorage?: Storage }).localStorage = createStorage({
      [STORAGE_KEY]: "{invalid-json",
    }) as Storage;

    expect(getCurrentProviderSnapshot()).toBeNull();
  });

  it("returns null when cache shape is invalid", () => {
    (globalThis as { localStorage?: Storage }).localStorage = createStorage({
      [STORAGE_KEY]: JSON.stringify({
        config: {
          baseUrl: "https://api.example.com",
        },
      }),
    }) as Storage;

    expect(getCurrentProviderSnapshot()).toBeNull();
  });
});
