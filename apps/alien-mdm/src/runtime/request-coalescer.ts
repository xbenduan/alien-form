/**
 * 合并仍在飞行中的同一请求；响应完成后立即释放，不作为数据缓存。
 * 用于消除 React StrictMode 的开发期重复副作用，同时不改变显式刷新语义。
 */
export function coalesceRequest<T>(
  requests: Map<string, Promise<T>>,
  key: string,
  request: () => Promise<T>,
): Promise<T> {
  const pending = requests.get(key);
  if (pending) return pending;

  const next = request().finally(() => {
    if (requests.get(key) === next) requests.delete(key);
  });
  requests.set(key, next);
  return next;
}
