import { createComputed, createRoot, createSignal } from "solid-js";
import type { ModelNavigationSnapshot } from "formwork/model";
import { errorPayload, FormworkError } from "formwork/model";
import { api, sessionToken, sessionUser } from "./models";

type MenuSession = {
  key: string;
  epoch: number;
  pending: number;
  queue: Promise<void>;
  read?: Promise<void>;
  readController?: AbortController;
  controllers: Set<AbortController>;
};
const [snapshot, setSnapshot] = createSignal<ModelNavigationSnapshot>();
const [loading, setLoading] = createSignal(false);
const [failure, setFailure] = createSignal("");
let session: MenuSession | undefined;
createRoot(() => {
  createComputed(() => {
    const token = sessionToken();
    const actor = sessionUser();
    const key = token && actor?.kind === "user" ? `${actor.id}:${token}` : undefined;
    if (key === session?.key) return;
    for (const controller of session?.controllers ?? []) controller.abort();
    session = key
      ? { key, epoch: 0, pending: 0, queue: Promise.resolve(), controllers: new Set() }
      : undefined;
    setSnapshot(undefined);
    setFailure("");
    setLoading(false);
  });
});

/** 返回当前账号最近成功的导航快照，账号变化时立即清空。 */
export const modelMenu = snapshot;
/** 表示当前账号正在读取菜单。 */
export const modelMenuLoading = loading;
/** 返回菜单同步错误，暂时失败时保留当前账号的成功快照。 */
export const modelMenuFailure = failure;

/** 合并重叠读取，并防止旧会话或固定操作之前的响应覆盖菜单。 */
export function refreshModelMenu(): Promise<void> {
  const current = session;
  if (!current) return Promise.resolve();
  if (current.pending) return current.queue.then(() => refreshModelMenu());
  if (current.read) return current.read;
  const controller = new AbortController();
  current.readController = controller;
  current.controllers.add(controller);
  const epoch = ++current.epoch;
  setLoading(true);
  const request = (async () => {
    try {
      const result = await api.navigation.read({ signal: controller.signal });
      if (session === current && current.epoch === epoch) {
        setSnapshot(result);
        setFailure("");
      }
    } catch (error) {
      if (session === current && !controller.signal.aborted && current.epoch === epoch)
        setFailure(errorPayload(error).message);
    } finally {
      current.controllers.delete(controller);
      if (current.readController === controller) current.read = undefined;
      if (session === current && current.epoch === epoch) setLoading(false);
    }
  })();
  current.read = request;
  return request;
}

/** 串行提交固定操作，以服务端成功快照同步列表与菜单。 */
export function setModelPinned(id: string, pinned: boolean): Promise<void> {
  const current = session;
  if (!current) return Promise.reject(new FormworkError("UNAUTHORIZED", "请先登录"));
  current.pending++;
  current.epoch++;
  current.readController?.abort();
  current.read = undefined;
  setLoading(false);
  const controller = new AbortController();
  current.controllers.add(controller);
  const operation = current.queue.then(async () => {
    if (session !== current) throw new FormworkError("UNAUTHORIZED", "登录会话已变化");
    const result = await api.navigation[pinned ? "pinModel" : "unpinModel"](id, {
      signal: controller.signal,
    });
    if (session === current) {
      setSnapshot(result);
      setFailure("");
    }
  });
  const result = operation.finally(() => {
    current.pending--;
    current.controllers.delete(controller);
  });
  current.queue = result.catch(() => {});
  return result;
}
