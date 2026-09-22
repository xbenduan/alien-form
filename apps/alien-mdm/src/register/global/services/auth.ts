import { defineService, type Runtime } from "@alien-form/engine";
import type { LoginRequest, LoginResponse } from "@app-types";
import { transport } from "@runtime/transport";

export function registerAuthServices(runtime: Runtime): void {
  runtime.service(
    "auth.login",
    defineService(
      (body: LoginRequest) =>
        transport.send<LoginResponse>("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      { description: "登录" },
    ),
  );
  runtime.service(
    "auth.logout",
    defineService(() => transport.send<void>("/api/v1/auth/logout", { method: "POST" }), {
      description: "退出登录",
    }),
  );
}
