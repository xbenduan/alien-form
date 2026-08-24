import type { ServiceDescribe } from "../../../runtime";
import { apiSend } from "../../../runtime/transport";
import type { LoginPayload, LoginResult } from "../../../runtime/types";

export const authServices: ServiceDescribe[] = [
  {
    code: "auth.login",
    send: (params) => {
      const payload = params as LoginPayload;
      return apiSend<LoginResult>("POST", "/auth/login", {
        provider: payload.provider ?? "password",
        username: payload.username,
        password: payload.password,
      });
    },
  },
  {
    code: "auth.logout",
    send: (params) => apiSend<void>("POST", "/auth/logout", params),
  },
];
