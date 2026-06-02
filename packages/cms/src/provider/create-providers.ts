import type { SchemaProvider } from "./schema-provider";
import type { RecordProvider } from "./record-provider";
import type { LogProvider } from "./log-provider";
import type { AlienCmsConfig } from "../types/config";
import { LocalSchemaProvider } from "./local/local-schema-provider";
import { LocalRecordProvider } from "./local/local-record-provider";
import { LocalLogProvider } from "./local/local-log-provider";
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

// ─── SDK Injection (avoid hard dependencies) ─────────────────

export interface SdkDependencies {
  /** Pass `cloudbase` from `@cloudbase/js-sdk` if using TCB. */
  cloudbase?: any;
  /** Pass `createClient` from `@supabase/supabase-js` if using Supabase. */
  supabaseCreateClient?: any;
}

// ─── Factory Function ────────────────────────────────────────

/**
 * Create a ProviderSet from an AlienCmsConfig.
 *
 * - provider = undefined or "local" → localStorage-based (demo mode)
 * - provider = "tcb" → Tencent CloudBase
 * - provider = "supabase" → Supabase (PostgreSQL)
 * - provider = "http" → Generic REST API
 *
 * SDK dependencies must be passed in via `sdks` to avoid hard imports.
 */
export function createProviders(config: AlienCmsConfig | undefined, sdks?: SdkDependencies): ProviderSet {
  // Default: local mode
  if (!config || !config.provider || config.provider === ("local" as any)) {
    return createLocalProviders();
  }

  switch (config.provider) {
    case "tcb":
      return createTcbProviders(config, sdks);
    case "supabase":
      return createSupabaseProviders(config, sdks);
    case "http":
      return createHttpProviders(config);
    default:
      throw new Error(`Unknown provider: ${(config as any).provider}`);
  }
}

// ─── Local ───────────────────────────────────────────────────

function createLocalProviders(): ProviderSet {
  return {
    schemaProvider: new LocalSchemaProvider(),
    recordProvider: new LocalRecordProvider(),
    logProvider: new LocalLogProvider(),
    healthCheck: checkLocalHealth,
  };
}

// ─── TCB ─────────────────────────────────────────────────────

function createTcbProviders(config: AlienCmsConfig, sdks?: SdkDependencies): ProviderSet {
  const cloudbase = sdks?.cloudbase;
  if (!cloudbase) {
    throw new Error(
      "TCB provider requires @cloudbase/js-sdk. " +
      "Install it and pass the module via sdks.cloudbase."
    );
  }

  const tcbConfig = (config as any).tcb;
  if (!tcbConfig?.envId) {
    throw new Error("TCB provider requires tcb.envId in config.");
  }

  // Lazy import to avoid bundling when not used
  const { createTcbClient } = require("./tcb/tcb-client");
  const { TcbSchemaProvider } = require("./tcb/tcb-schema-provider");
  const { TcbRecordProvider } = require("./tcb/tcb-record-provider");
  const { TcbLogProvider } = require("./tcb/tcb-log-provider");

  const client = createTcbClient({
    cloudbase,
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

function createSupabaseProviders(config: AlienCmsConfig, sdks?: SdkDependencies): ProviderSet {
  const createClient = sdks?.supabaseCreateClient;
  if (!createClient) {
    throw new Error(
      "Supabase provider requires @supabase/supabase-js. " +
      "Install it and pass createClient via sdks.supabaseCreateClient."
    );
  }

  const supaConfig = (config as any).supabase;
  if (!supaConfig?.url || !supaConfig?.anonKey) {
    throw new Error("Supabase provider requires supabase.url and supabase.anonKey in config.");
  }

  const { createSupabaseProvider } = require("./supabase/supabase-client");
  const { SupabaseSchemaProvider } = require("./supabase/supabase-schema-provider");
  const { SupabaseRecordProvider } = require("./supabase/supabase-record-provider");
  const { SupabaseLogProvider } = require("./supabase/supabase-log-provider");

  const provider = createSupabaseProvider({
    createClient,
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

  const { HttpClient } = require("./http/http-client");
  const { HttpSchemaProvider } = require("./http/http-schema-provider");
  const { HttpRecordProvider } = require("./http/http-record-provider");
  const { HttpLogProvider } = require("./http/http-log-provider");

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
