import { apiSend } from "../../../runtime/transport";
import type { LoginPayload, LoginResult } from "../../../runtime/types";
import type { ServiceSend } from "./index";

/** 登录 / 登出 API 客户端。 */
export const authServices: Record<string, ServiceSend> = {
  "auth.login": (params) => {
    const payload = params as LoginPayload;
    return apiSend<LoginResult>("POST", "/auth/login", {
      provider: payload.provider ?? "password",
      username: payload.username,
      password: payload.password,
    });
  },
  "auth.logout": (params) => apiSend<void>("POST", "/auth/logout", params),
};
