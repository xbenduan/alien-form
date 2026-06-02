import type { SchemaProvider, RecordProvider } from './types';

let schemaProvider: SchemaProvider | null = null;
let recordProvider: RecordProvider | null = null;

export function getSchemaProvider(): SchemaProvider {
  if (!schemaProvider) throw new Error('[cms] call connect() before using schema operations');
  return schemaProvider;
}

export function getRecordProvider(): RecordProvider {
  if (!recordProvider) throw new Error('[cms] call connect() before using record operations');
  return recordProvider;
}

export function setProviders(schema: SchemaProvider, record: RecordProvider) {
  schemaProvider = schema;
  recordProvider = record;
}

export function clearProviders() {
  schemaProvider = null;
  recordProvider = null;
}
