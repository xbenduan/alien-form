import type { SchemaProvider } from "./schema-provider";
import type { RecordProvider } from "./record-provider";
import type { LogProvider } from "./log-provider";
import type { AlienCmsConfig } from "../types/config";
import { LocalSchemaProvider } from "./local/local-schema-provider";
import { LocalRecordProvider } from "./local/local-record-provider";
import { LocalLogProvider } from "./local/local-log-provider";
import { HttpClient } from "./http/http-client";
import { HttpSchemaProvider } from "./http/http-schema-provider";
import { HttpRecordProvider } from "./http/http-record-provider";
import { HttpLogProvider } from "./http/http-log-provider";
import { checkLocalHealth, checkHttpHealth } from "./health";
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
 * - baseUrl absent → in-memory demo mode (local)
 * - baseUrl present → HTTP provider (remote server)
 */
export function createProviders(config?: AlienCmsConfig): ProviderSet {
  if (!config?.baseUrl) {
    return createLocalProviders();
  }
  return createHttpProviders(config);
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

// ─── HTTP ────────────────────────────────────────────────────

function createHttpProviders(config: AlienCmsConfig): ProviderSet {
  const baseUrl = config.baseUrl!;

  const client = new HttpClient({
    baseUrl,
    adapter: config.adapter,
    headers: config.options?.headers,
    timeout: config.options?.timeout,
  });

  return {
    schemaProvider: new HttpSchemaProvider(client),
    recordProvider: new HttpRecordProvider(client),
    logProvider: new HttpLogProvider(client),
    healthCheck: () => checkHttpHealth(client, baseUrl),
  };
}
