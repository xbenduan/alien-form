import type { SchemaProvider, RecordProvider, ProviderFactory } from './types';

const PROVIDER_KEY = 'alien-cms-provider';

// ─── Factory Registry ─────────────────────────────────────────
const factories = new Map<string, ProviderFactory>();

// ─── Active Providers ─────────────────────────────────────────
let schemaProvider: SchemaProvider | null = null;
let recordProvider: RecordProvider | null = null;
let localFactory: ProviderFactory | null = null;

/**
 * Register a provider factory.
 * Called by each provider implementation (supabase, tcb, http, etc.)
 *
 * @example
 * registerProvider('supabase', createSupabaseProviders);
 */
export function registerProvider(type: string, factory: ProviderFactory) {
  factories.set(type, factory);
}

/**
 * Initialize provider system.
 * Reads browser cache to determine active provider.
 * Falls back to local if no cache or cache is invalid.
 */
export function initProvider(local: ProviderFactory) {
  localFactory = local;

  const cached = readCache();
  if (cached) {
    const factory = factories.get(cached.type);
    if (factory) {
      try {
        const providers = factory(cached.config);
        schemaProvider = providers.schema;
        recordProvider = providers.record;
        return;
      } catch {
        // Factory failed, fall through to local
      }
    }
  }

  // Fallback: local provider
  const providers = local({});
  schemaProvider = providers.schema;
  recordProvider = providers.record;
}

/**
 * Switch to a different provider.
 * Writes config to cache so it persists across page refreshes.
 */
export function switchProvider(type: string, config: any) {
  const factory = factories.get(type);
  if (!factory) {
    throw new Error(`[cms] Unknown provider type: "${type}". Did you call registerProvider()?`);
  }

  const providers = factory(config);
  schemaProvider = providers.schema;
  recordProvider = providers.record;

  writeCache(type, config);
}

/**
 * Reset to local provider and clear cache.
 */
export function resetProvider() {
  if (!localFactory) {
    throw new Error('[cms] call initProvider() before resetProvider()');
  }

  clearCache();
  const providers = localFactory({});
  schemaProvider = providers.schema;
  recordProvider = providers.record;
}

/**
 * Get current provider type from cache.
 * Returns undefined if using local (no cache).
 */
export function getCurrentProviderType(): string | undefined {
  return readCache()?.type;
}

// ─── Getters ──────────────────────────────────────────────────

export function getSchemaProvider(): SchemaProvider {
  if (!schemaProvider) {
    throw new Error('[cms] Provider not initialized. Call initProvider() at app startup.');
  }
  return schemaProvider;
}

export function getRecordProvider(): RecordProvider {
  if (!recordProvider) {
    throw new Error('[cms] Provider not initialized. Call initProvider() at app startup.');
  }
  return recordProvider;
}

// ─── Cache Helpers (localStorage) ─────────────────────────────

function readCache(): { type: string; config: any } | null {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.type && typeof parsed.type === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCache(type: string, config: any) {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify({ type, config }));
}

function clearCache() {
  localStorage.removeItem(PROVIDER_KEY);
}
