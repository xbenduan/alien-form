import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModelRouteState } from '../types/model';

const MODEL_ROUTE_PREFIX = '/models';

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

function extractRouteState(pathname: string) {
  if (pathname === '/' || pathname === MODEL_ROUTE_PREFIX || pathname === `${MODEL_ROUTE_PREFIX}/`) {
    return {
      modelName: undefined,
      action: { mode: 'closed' } satisfies ModelRouteState,
    };
  }

  const match = pathname.match(/^\/models\/([^/]+)(?:\/(add|edit|detail)(?:\/([^/]+))?)?$/);
  return {
    modelName: match?.[1],
    action: normalizeRouteState({
      mode: (match?.[2] as ModelRouteState['mode'] | undefined) ?? 'closed',
      recordId: match?.[3],
    }),
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

export function useModelRoute(availableModels: string[], defaultModel: string) {
  const allowedModels = useMemo(() => new Set(availableModels), [availableModels]);

  const getCurrentRoute = useCallback(() => {
    const pathname = window.location.pathname;
    const routeState = extractRouteState(pathname);
    const isAllowedModel = Boolean(routeState.modelName && allowedModels.has(routeState.modelName));
    const currentModel = isAllowedModel ? routeState.modelName! : defaultModel;

    return {
      currentModel,
      currentAction: isAllowedModel ? routeState.action : ({ mode: 'closed' } satisfies ModelRouteState),
    };
  }, [allowedModels, defaultModel]);

  const [routeState, setRouteState] = useState(getCurrentRoute);

  useEffect(() => {
    const syncWithLocation = () => {
      const nextRoute = getCurrentRoute();
      const nextPath = buildModelPath(nextRoute.currentModel, nextRoute.currentAction);
      if (window.location.pathname !== nextPath) {
        window.history.replaceState({}, '', nextPath);
      }
      setRouteState(nextRoute);
    };

    syncWithLocation();
    window.addEventListener('popstate', syncWithLocation);
    return () => window.removeEventListener('popstate', syncWithLocation);
  }, [getCurrentRoute]);

  const navigateToModel = useCallback(
    (modelName: string) => {
      if (!allowedModels.has(modelName)) {
        return;
      }

      const nextRoute = {
        currentModel: modelName,
        currentAction: { mode: 'closed' } satisfies ModelRouteState,
      };
      const nextPath = buildModelPath(nextRoute.currentModel, nextRoute.currentAction);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
      setRouteState(nextRoute);
    },
    [allowedModels],
  );

  const navigateToAction = useCallback((nextAction: ModelRouteState) => {
    setRouteState((currentRouteState) => {
      const normalizedAction = normalizeRouteState(nextAction);
      const nextRoute = {
        currentModel: currentRouteState.currentModel,
        currentAction: normalizedAction,
      };
      const nextPath = buildModelPath(nextRoute.currentModel, nextRoute.currentAction);

      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }

      return nextRoute;
    });
  }, []);

  return {
    currentModel: routeState.currentModel,
    currentAction: routeState.currentAction,
    currentPath: buildModelPath(routeState.currentModel, routeState.currentAction),
    navigateToModel,
    navigateToAction,
    closeAction: () => navigateToAction({ mode: 'closed' }),
  };
}
