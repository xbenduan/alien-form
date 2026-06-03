import type { AuthConfig } from "../types/config";

// ─── Auth Result ─────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

// ─── Auth Adapter Interface ──────────────────────────────────

/**
 * Adapter for authentication.
 * Not a persistent CRUD provider — handles the one-time connection authentication
 * and token lifecycle.
 *
 * - TCB: SDK manages tokens internally, getToken() returns undefined.
 * - Supabase: supabase-js manages JWT internally, getToken() optional.
 * - HTTP: getToken() provides the Bearer token for request headers.
 */
export interface AuthAdapter {
  /** Initialize authentication based on config. */
  authenticate(config: AuthConfig): Promise<AuthResult>;

  /** Get the current access token (for HTTP Authorization header). */
  getToken(): string | undefined;

  /** Refresh the token. Returns new auth result. */
  refresh(): Promise<AuthResult>;

  /** Sign out and clear credentials. */
  signOut(): Promise<void>;
}
