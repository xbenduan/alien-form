import type { ModelRouteState } from '../types/model';

export const MODEL_ROUTE_PREFIX = '/m';
export const BUILDER_ROUTE_PREFIX = '/builder';

function normalizeRouteState(routeState?: ModelRouteState): ModelRouteState {
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

export function buildModelPath(modelName: string, routeState: ModelRouteState = { mode: 'closed' }) {
  const normalizedRouteState = normalizeRouteState(routeState);

  if (normalizedRouteState.mode === 'closed') {
    return `${MODEL_ROUTE_PREFIX}/${modelName}`;
  }

  if (normalizedRouteState.mode === 'add') {
    return `${MODEL_ROUTE_PREFIX}/${modelName}/add`;
  }

  return `${MODEL_ROUTE_PREFIX}/${modelName}/${normalizedRouteState.mode}/${normalizedRouteState.recordId}`;
}

export function buildBuilderNewPath() {
  return `${BUILDER_ROUTE_PREFIX}/new`;
}

export function buildBuilderEditPath(modelName: string) {
  return `${BUILDER_ROUTE_PREFIX}/edit/${modelName}`;
}
