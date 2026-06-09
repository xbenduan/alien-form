import type { HttpClient } from "./http/http-client";

interface StorageLike {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

declare const AbortController: new () => { signal: unknown; abort(): void };
declare const fetch: (input: string, init?: { signal?: unknown }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<any>;
}>;
declare function setTimeout(callback: () => void, delay: number): unknown;
declare function clearTimeout(handle: unknown): void;

// ─── Health Check Result ─────────────────────────────────────

export interface HealthCheckResult {
  ok: boolean;
  provider: "http" | "local";
  latency: number;
  message?: string;
  capabilities?: {
    schemas: boolean;
    records: boolean;
    logs: boolean;
  };
}

// ─── Local Health Check ─────────────────────────────────────

export async function checkLocalHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const storage = getStorage();
    storage?.setItem("alien-cms:health", "ok");
    storage?.removeItem("alien-cms:health");
    return {
      ok: true,
      provider: "local",
      latency: Date.now() - start,
      capabilities: { schemas: true, records: true, logs: true },
    };
  } catch (error) {
    return {
      ok: false,
      provider: "local",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "local storage unavailable",
    };
  }
}

// ─── HTTP Health Check ──────────────────────────────────────

export async function checkHttpHealth(client: HttpClient, baseUrl: string): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const response = await client.request<any>("/health");
    return {
      ok: true,
      provider: "http",
      latency: Date.now() - start,
      message: response?.message ?? "Connected.",
      capabilities: response?.capabilities ?? { schemas: true, records: true, logs: true },
    };
  } catch {
    // Fallback: try .well-known/alien-cms.json
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${baseUrl}/.well-known/alien-cms.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const manifest = await resp.json();
      return {
        ok: true,
        provider: "http",
        latency: Date.now() - start,
        message: `Connected to ${manifest.name ?? "backend"}.`,
        capabilities: manifest.capabilities ?? { schemas: true, records: true, logs: true },
      };
    }

    return {
      ok: false,
      provider: "http",
      latency: Date.now() - start,
      message: `HTTP ${resp.status}: ${resp.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "http",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

function getStorage(): StorageLike | undefined {
  return (globalThis as { localStorage?: StorageLike }).localStorage;
}
