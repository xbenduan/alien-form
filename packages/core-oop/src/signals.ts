import { setActiveSub } from "alien-signals";

/**
 * 在不建立依赖订阅的前提下执行 fn（alien-signals 3.2.1 未导出 untracked，此为薄封装）。
 * 通过临时把当前活跃订阅者置空，读取信号时便不会被记录为依赖。
 */
export function untrack<T>(fn: () => T): T {
  const prev = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(prev);
  }
}
