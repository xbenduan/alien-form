const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const AUTH_STORAGE_KEY = "alien-mdm-auth";
const UNAUTHORIZED_EVENT = "alien-mdm:unauthorized";

function authorizationHeader(): Record<string, string> {
  try {
    const text = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const token = text ? (JSON.parse(text) as { token?: unknown }).token : undefined;
    return typeof token === "string" && token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function clearAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) clearAuth();
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `请求失败：${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`, { headers: authorizationHeader() }).then((res) => parse<T>(res));
}

export function apiSend<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...authorizationHeader(),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((res) => parse<T>(res));
}
