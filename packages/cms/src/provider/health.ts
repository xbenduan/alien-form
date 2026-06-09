import type { HttpClient } from "./http/http-client";

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

// ─── Health Check Functions ──────────────────────────────────

/**
 * Health check for Local provider.
 * Always succeeds — in-memory store is always available.
 */
export async function checkLocalHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  return {
    ok: true,
    provider: "local",
    latency: Date.now() - start,
    capabilities: { schemas: true, records: true, logs: true },
  };
}

/**
 * Health check for HTTP provider.
 * Tries GET {baseUrl}/health endpoint.
 */
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
  } catch (error) {
    return {
      ok: false,
      provider: "http",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
