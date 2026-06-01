import { useCallback, useEffect, useMemo, useState } from 'react';

const MODEL_ROUTE_PREFIX = '/models';

function extractModelName(pathname: string) {
  if (pathname === '/' || pathname === MODEL_ROUTE_PREFIX || pathname === `${MODEL_ROUTE_PREFIX}/`) {
    return undefined;
  }

  const match = pathname.match(/^\/models\/([^/]+)$/);
  return match?.[1];
}

export function buildModelPath(modelName: string) {
  return `${MODEL_ROUTE_PREFIX}/${modelName}`;
}

export function useModelRoute(availableModels: string[], defaultModel: string) {
  const allowedModels = useMemo(() => new Set(availableModels), [availableModels]);

  const getCurrentModel = useCallback(() => {
    const pathname = window.location.pathname;
    const modelFromPath = extractModelName(pathname);
    return modelFromPath && allowedModels.has(modelFromPath) ? modelFromPath : defaultModel;
  }, [allowedModels, defaultModel]);

  const [currentModel, setCurrentModel] = useState(getCurrentModel);

  useEffect(() => {
    const syncWithLocation = () => {
      const nextModel = getCurrentModel();
      const nextPath = buildModelPath(nextModel);
      if (window.location.pathname !== nextPath) {
        window.history.replaceState({}, '', nextPath);
      }
      setCurrentModel(nextModel);
    };

    syncWithLocation();
    window.addEventListener('popstate', syncWithLocation);
    return () => window.removeEventListener('popstate', syncWithLocation);
  }, [getCurrentModel]);

  const navigateToModel = useCallback(
    (modelName: string) => {
      if (!allowedModels.has(modelName)) {
        return;
      }

      const nextPath = buildModelPath(modelName);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
      setCurrentModel(modelName);
    },
    [allowedModels],
  );

  return {
    currentModel,
    currentPath: buildModelPath(currentModel),
    navigateToModel,
  };
}
