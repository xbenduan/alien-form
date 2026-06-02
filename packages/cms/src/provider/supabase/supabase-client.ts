/**
 * Supabase client initialization.
 *
 * Requires: @supabase/supabase-js (peerDependency, optional)
 *
 * Usage:
 *   import { createClient } from "@supabase/supabase-js";
 *   const provider = createSupabaseProvider({ createClient, url, anonKey });
 */

export interface SupabaseProviderOptions {
  /**
   * The createClient function from `@supabase/supabase-js`.
   * Passed in to avoid hard dependency on the SDK.
   */
  createClient: any;
  /** Supabase project URL. */
  url: string;
  /** Supabase anon key. */
  anonKey: string;
  /** Table name overrides. */
  tables?: {
    schemas?: string;
    records?: string;
    logs?: string;
  };
}

export interface SupabaseProvider {
  /** The SupabaseClient instance. */
  client: any;
  /** Resolved table names. */
  tables: Required<NonNullable<SupabaseProviderOptions["tables"]>>;
}

const DEFAULT_TABLES = {
  schemas: "alien_cms_schemas",
  records: "alien_cms_records",
  logs: "alien_cms_logs",
};

export function createSupabaseProvider(options: SupabaseProviderOptions): SupabaseProvider {
  const { createClient, url, anonKey, tables } = options;

  const client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return {
    client,
    tables: { ...DEFAULT_TABLES, ...tables },
  };
}
