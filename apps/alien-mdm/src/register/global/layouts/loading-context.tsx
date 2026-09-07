import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

interface LayoutLoading {
  loading: boolean;
  startLoading(): () => void;
}

const DEFAULT_LOADING: LayoutLoading = {
  loading: false,
  startLoading: () => () => undefined,
};

const LayoutLoadingContext = createContext<LayoutLoading>(DEFAULT_LOADING);

export function LayoutLoadingProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState(0);
  const startLoading = useCallback(() => {
    let stopped = false;
    setPending((current) => current + 1);
    return () => {
      if (stopped) return;
      stopped = true;
      setPending((current) => Math.max(0, current - 1));
    };
  }, []);
  const value = useMemo(() => ({ loading: pending > 0, startLoading }), [pending, startLoading]);
  return <LayoutLoadingContext.Provider value={value}>{children}</LayoutLoadingContext.Provider>;
}

export function useLayoutLoading(): LayoutLoading {
  return useContext(LayoutLoadingContext);
}
