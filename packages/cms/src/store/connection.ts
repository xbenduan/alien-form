import { connected } from '../internal/signals';
import { setProviders, clearProviders } from '../internal/provider';
import type { SchemaProvider, RecordProvider } from '../internal/types';

/**
 * Connect to data providers. Call once at app startup.
 */
export function connect(schema: SchemaProvider, record: RecordProvider) {
  setProviders(schema, record);
  connected.set(true);
}

/**
 * Disconnect and reset providers.
 */
export function disconnect() {
  clearProviders();
  connected.set(false);
}
