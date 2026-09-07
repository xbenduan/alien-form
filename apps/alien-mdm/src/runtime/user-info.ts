const USER_INFO_STORAGE_KEY = "alien-mdm-user";

export type UserInfo = Record<string, unknown> & {
  id?: string;
  nickname?: string;
  super?: boolean;
};

declare global {
  interface Window {
    _userInfo?: UserInfo;
  }
}

function readStoredUserInfo(): UserInfo | undefined {
  try {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as UserInfo)
      : undefined;
  } catch {
    return undefined;
  }
}

/** 应用挂载前恢复用户，使后续运行时逻辑始终从 window._userInfo 读取。 */
export function hydrateUserInfo(): void {
  const user = readStoredUserInfo();
  if (user) window._userInfo = user;
  else delete window._userInfo;
}

export function userInfo(): UserInfo | undefined {
  return window._userInfo;
}

export function isSuperAdmin(): boolean {
  return window._userInfo?.super === true;
}

export function setUserInfo(user: UserInfo): void {
  window._userInfo = user;
  localStorage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(user));
}

export function clearUserInfo(): void {
  delete window._userInfo;
  localStorage.removeItem(USER_INFO_STORAGE_KEY);
}
