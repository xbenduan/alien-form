/**
 * Path builder utilities.
 * These are used by components to navigate programmatically.
 * Route definitions live in ./routes.tsx — this file only builds URL strings.
 */
import type { RecordRouteState } from '../../domains/record/types/record';

export function buildModelListPath() {
  return '/models';
}

export function buildModelNewPath() {
  return '/models/new';
}

export function buildModelEditPath(modelName: string) {
  return `/models/${modelName}/edit`;
}

export function buildSystemSettingsPath() {
  return '/system/settings';
}

export function buildSystemLogsPath() {
  return '/system/logs';
}

export function buildAboutPath() {
  return '/system/about';
}

export function buildRecordPath(modelName: string, routeState: RecordRouteState = { mode: 'closed' }) {
  const base = `/records/${modelName}`;

  if (!routeState || routeState.mode === 'closed') {
    return base;
  }

  if (routeState.mode === 'add') {
    return `${base}/add`;
  }

  if (!routeState.recordId) {
    return base;
  }

  return `${base}/${routeState.mode}/${routeState.recordId}`;
}
