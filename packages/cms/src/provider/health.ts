import type { TcbClient } from "./tcb/tcb-client";
import type { SupabaseProvider } from "./supabase/supabase-client";
import type { HttpClient } from "./http/http-client";

// ─── Health Check Result ─────────────────────────────────────

export interface HealthCheckResult {
  ok: boolean;
  provider: "tcb" | "supabase" | "http" | "local";
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
 * Always succeeds — localStorage is always available.
 */
export async function checkLocalHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    localStorage.setItem("alien-cms:health", "ok");
    localStorage.removeItem("alien-cms:health");
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
      message: error instanceof Error ? error.message : "localStorage unavailable",
    };
  }
}

/**
 * Health check for TCB provider.
 * Verifies: auth state + database read access.
 */
export async function checkTcbHealth(client: TcbClient): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Ensure authenticated
    await client.auth();

    // Try a simple read (count schemas collection)
    const db = client.database();
    const { total } = await db.collection(client.collections.schemas).count();

    return {
      ok: true,
      provider: "tcb",
      latency: Date.now() - start,
      message: `Connected. ${total} schema(s) found.`,
      capabilities: { schemas: true, records: true, logs: true },
    };
  } catch (error) {
    return {
      ok: false,
      provider: "tcb",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "TCB connection failed",
    };
  }
}

/**
 * Health check for Supabase provider.
 * Verifies: client connection + table access.
 */
export async function checkSupabaseHealth(provider: SupabaseProvider): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Try counting rows in schemas table
    const { count, error } = await provider.client
      .from(provider.tables.schemas)
      .select("model_name", { count: "exact", head: true });

    if (error) {
      return {
        ok: false,
        provider: "supabase",
        latency: Date.now() - start,
        message: error.message,
      };
    }

    return {
      ok: true,
      provider: "supabase",
      latency: Date.now() - start,
      message: `Connected. ${count ?? 0} schema(s) found.`,
      capabilities: { schemas: true, records: true, logs: true },
    };
  } catch (error) {
    return {
      ok: false,
      provider: "supabase",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Supabase connection failed",
    };
  }
}

/**
 * Health check for HTTP provider.
 * Tries: GET {baseUrl}/health or GET {baseUrl}/.well-known/alien-cms.json
 */
export async function checkHttpHealth(client: HttpClient, baseUrl: string): Promise<HealthCheckResult> {
  const start = Date.now();

  // Try /health endpoint first
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
