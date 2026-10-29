import { onCleanup } from "solid-js";

// 所有受管资源先失效，再执行可能抛错的清理。
export function lifetime() {
  const controller = new AbortController();
  let alive = true;
  const stops = new Set<() => void>();
  const cleanups = new Set<() => void>();
  const safely = (action: () => void) => {
    try {
      action();
    } catch (error) {
      console.error("Formwork cleanup:", error);
    }
  };
  const dispose = () => {
    if (!alive) return;
    alive = false;
    controller.abort();
    for (const stop of stops) safely(stop);
    for (const cleanup of cleanups) safely(cleanup);
    stops.clear();
    cleanups.clear();
  };
  onCleanup(dispose);
  return { signal: controller.signal, alive: () => alive, stops, cleanups, dispose };
}
