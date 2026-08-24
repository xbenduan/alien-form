/**
 * 唯一的 HTTP transport。业务与 UI 不得直接调用，所有请求必须由注册 service 封装。
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `请求失败：${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`).then((res) => parse<T>(res));
}

export function apiSend<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((res) => parse<T>(res));
}
