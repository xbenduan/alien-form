import type { RecordRouteState } from '../../domains/record/types/record';

export const RECORD_ROUTE_PREFIX = '/records';
export const MODEL_ROUTE_PREFIX = '/models';

export function buildModelListPath() {
  return MODEL_ROUTE_PREFIX;
}

function normalizeRouteState(routeState?: RecordRouteState): RecordRouteState {
  if (!routeState || routeState.mode === 'closed') {
    return { mode: 'closed' };
  }

  if (routeState.mode === 'add') {
    return { mode: 'add' };
  }

  if (!routeState.recordId) {
    return { mode: 'closed' };
  }

  return {
    mode: routeState.mode,
    recordId: routeState.recordId,
  };
}

export function buildRecordPath(modelName: string, routeState: RecordRouteState = { mode: 'closed' }) {
  const normalizedRouteState = normalizeRouteState(routeState);

  if (normalizedRouteState.mode === 'closed') {
    return `${RECORD_ROUTE_PREFIX}/${modelName}`;
  }

  if (normalizedRouteState.mode === 'add') {
    return `${RECORD_ROUTE_PREFIX}/${modelName}/add`;
  }

  return `${RECORD_ROUTE_PREFIX}/${modelName}/${normalizedRouteState.mode}/${normalizedRouteState.recordId}`;
}

export function buildModelNewPath() {
  return `${MODEL_ROUTE_PREFIX}/new`;
}

export function buildModelEditPath(modelName: string) {
  return `${MODEL_ROUTE_PREFIX}/${modelName}/edit`;
}
