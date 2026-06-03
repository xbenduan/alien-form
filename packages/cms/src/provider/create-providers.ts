import type { SchemaProvider } from "./schema-provider";
import type { RecordProvider } from "./record-provider";
import type { LogProvider } from "./log-provider";
import type { AlienCmsConfig } from "../types/config";
import { LocalSchemaProvider } from "./local/local-schema-provider";
import { LocalRecordProvider } from "./local/local-record-provider";
import { LocalLogProvider } from "./local/local-log-provider";
import { createTcbClient } from "./tcb/tcb-client";
import { TcbSchemaProvider } from "./tcb/tcb-schema-provider";
import { TcbRecordProvider } from "./tcb/tcb-record-provider";
import { TcbLogProvider } from "./tcb/tcb-log-provider";
import { createSupabaseProvider } from "./supabase/supabase-client";
import { SupabaseSchemaProvider } from "./supabase/supabase-schema-provider";
import { SupabaseRecordProvider } from "./supabase/supabase-record-provider";
import { SupabaseLogProvider } from "./supabase/supabase-log-provider";
import { HttpClient } from "./http/http-client";
import { HttpSchemaProvider } from "./http/http-schema-provider";
import { HttpRecordProvider } from "./http/http-record-provider";
import { HttpLogProvider } from "./http/http-log-provider";
import {
  checkLocalHealth,
  checkTcbHealth,
  checkSupabaseHealth,
  checkHttpHealth,
} from "./health";
import type { HealthCheckResult } from "./health";

// ─── Provider Set ────────────────────────────────────────────

export interface ProviderSet {
  schemaProvider: SchemaProvider;
  recordProvider: RecordProvider;
  logProvider: LogProvider;
  /** Run a health check against the configured backend. */
  healthCheck(): Promise<HealthCheckResult>;
}

// ─── Factory Function ────────────────────────────────────────

/**
 * Create a ProviderSet from an AlienCmsConfig.
 *
 * - provider = undefined or "local" → in-memory demo mode
 * - provider = "tcb" → Tencent CloudBase
 * - provider = "supabase" → Supabase (PostgreSQL)
 * - provider = "http" → Generic REST API
 */
export function createProviders(config?: AlienCmsConfig): ProviderSet {
  // Default: local mode
  if (!config || !config.provider || config.provider === ("local" as any)) {
    return createLocalProviders();
  }

  switch (config.provider) {
    case "tcb":
      return createTcbProviders(config);
    case "supabase":
      return createSupabaseProviders(config);
    case "http":
      return createHttpProviders(config);
    default:
      throw new Error(`Unknown provider: ${(config as any).provider}`);
  }
}

// ─── Local ───────────────────────────────────────────────────

function createLocalProviders(options?: { seedDemo?: boolean }): ProviderSet {
  return {
    schemaProvider: new LocalSchemaProvider({ seedDemo: options?.seedDemo ?? true }),
    recordProvider: new LocalRecordProvider({ seedDemo: options?.seedDemo ?? true }),
    logProvider: new LocalLogProvider(),
    healthCheck: checkLocalHealth,
  };
}

// ─── TCB ─────────────────────────────────────────────────────

function createTcbProviders(config: AlienCmsConfig): ProviderSet {
  const tcbConfig = (config as any).tcb;
  if (!tcbConfig?.envId) {
    throw new Error("TCB provider requires tcb.envId in config.");
  }

  const client = createTcbClient({
    envId: tcbConfig.envId,
    region: tcbConfig.region,
    authType: config.auth?.type === "anonymous" ? "anonymous" : "custom",
    ticket: (config.auth as any)?.ticket,
    collections: tcbConfig.collections,
  });

  return {
    schemaProvider: new TcbSchemaProvider(client),
    recordProvider: new TcbRecordProvider(client),
    logProvider: new TcbLogProvider(client),
    healthCheck: () => checkTcbHealth(client),
  };
}

// ─── Supabase ────────────────────────────────────────────────

function createSupabaseProviders(config: AlienCmsConfig): ProviderSet {
  const supaConfig = (config as any).supabase;
  if (!supaConfig?.url || !supaConfig?.anonKey) {
    throw new Error("Supabase provider requires supabase.url and supabase.anonKey in config.");
  }

  const provider = createSupabaseProvider({
    url: supaConfig.url,
    anonKey: supaConfig.anonKey,
    tables: supaConfig.tables,
  });

  return {
    schemaProvider: new SupabaseSchemaProvider(provider),
    recordProvider: new SupabaseRecordProvider(provider),
    logProvider: new SupabaseLogProvider(provider),
    healthCheck: () => checkSupabaseHealth(provider),
  };
}

// ─── HTTP ────────────────────────────────────────────────────

function createHttpProviders(config: AlienCmsConfig): ProviderSet {
  const httpConfig = (config as any).http;
  if (!httpConfig?.baseUrl) {
    throw new Error("HTTP provider requires http.baseUrl in config.");
  }

  const client = new HttpClient({
    baseUrl: httpConfig.baseUrl,
    adapter: httpConfig.adapter,
    headers: config.options?.headers,
    timeout: config.options?.timeout,
  });

  const endpoints = httpConfig.endpoints ?? {};

  return {
    schemaProvider: new HttpSchemaProvider(client, endpoints.schemas),
    recordProvider: new HttpRecordProvider(client, endpoints.records),
    logProvider: new HttpLogProvider(client, endpoints.logs),
    healthCheck: () => checkHttpHealth(client, httpConfig.baseUrl),
  };
}
