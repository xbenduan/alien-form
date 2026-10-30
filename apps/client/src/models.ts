import { createSignal } from "solid-js";
import { createFormworkApi, errorPayload } from "formwork/model";
import type { PageLoadContext } from "formwork";
import type { ActorSummary } from "formwork/model";

const sessionKey = "formwork-user-session";
const localPreview =
  window.parent !== window &&
  /^\/model-preview\/[a-z][a-z0-9_-]*$/u.test(location.pathname) &&
  new URLSearchParams(location.search).get("embedded") === "1";
const [token, setToken] = createSignal(
  localPreview ? undefined : (sessionStorage.getItem(sessionKey) ?? undefined),
);
const [user, setUser] = createSignal<ActorSummary>();
const [loading, setLoading] = createSignal(!!token());
const [failure, setFailure] = createSignal("");
/** 返回当前浏览器标签页的用户会话。 */
export const sessionToken = token;
/** 返回 Worker 已确认的可信身份。 */
export const sessionUser = user;
/** 表示当前标签页正在核实持久化会话。 */
export const sessionLoading = loading;
/** 返回会话核实的临时错误，网络失败时保留当前登录凭证。 */
export const sessionFailure = failure;
/** 更新当前标签页登录会话，并同步 sessionStorage。 */
export function setSessionToken(value?: string) {
  if (value) sessionStorage.setItem(sessionKey, value);
  else sessionStorage.removeItem(sessionKey);
  if (value !== token()) {
    setUser(undefined);
    setFailure("");
    setLoading(false);
  }
  setToken(value);
  if (!value) setUser(undefined);
}
/** 通过唯一 Worker API 访问所有模型、认证和记录。 */
export const api = createFormworkApi({
  url: import.meta.env.VITE_FORMWORK_API_URL ?? "/api/v1",
  token,
  onUnauthorized: () => setSessionToken(),
});
/** 登录后仅在当前标签页保存 token，并显示服务端身份。 */
export async function login(username: string, password: string, signal?: AbortSignal) {
  const result = await api.auth.login(username, password, { signal });
  setSessionToken(result.token);
  setUser(result.user);
}
/** 注销服务端 credential 并清理当前标签页会话。 */
export async function logout() {
  try {
    await api.auth.logout();
  } finally {
    setSessionToken();
  }
}
async function restoreSession() {
  const expected = token();
  if (!expected) return;
  setFailure("");
  setLoading(true);
  try {
    const actor = await api.auth.me();
    if (expected === token()) setUser(actor);
  } catch (error) {
    // 401 已由 API client 清理；iframe 卸载导致的 fetch 中断不能注销外层会话。
    if (expected === token()) setFailure(errorPayload(error).message);
  } finally {
    if (expected === token()) setLoading(false);
  }
}
/** 在临时网络失败后重新核实保留的登录凭证。 */
export function retrySession(): Promise<void> {
  return loading() ? Promise.resolve() : restoreSession();
}
// 嵌入画布只接收父页 Schema 并使用本地数据。
if (!localPreview) void restoreSession();
/** 为 Page 和 Window 显式加载当前授权的已发布 schema。 */
export async function loadPublishedSchema(ctx: PageLoadContext) {
  return (await ctx.api.runtime.schema(ctx.domain, { signal: ctx.signal })).schema;
}
