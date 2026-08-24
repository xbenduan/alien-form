import { apiSend } from "./api-client";
import type { ModelRecord } from "./types";

export interface AuthUser extends ModelRecord {
  username?: string;
  displayName?: string;
  userType?: string;
  status?: string;
  roleIds?: string[];
}

export interface LoginPayload {
  provider?: "password" | string;
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  provider: string;
  user: AuthUser;
}

export function login(payload: LoginPayload): Promise<LoginResult> {
  return apiSend<LoginResult>("POST", "/auth/login", {
    provider: payload.provider ?? "password",
    username: payload.username,
    password: payload.password,
  });
}

export function logout(token: string): Promise<void> {
  return apiSend<void>("POST", "/auth/logout", { token });
}
