import { defineService, type Runtime } from "@alien-form/engine";
import type { LoginRequest } from "@app-types";
import { sdkClient } from "@runtime/sdk-client";

export function registerAuthServices(runtime: Runtime): void {
  runtime.service(
    "auth.login",
    defineService(
      (body: LoginRequest) =>
        sdkClient.auth.login(body),
      { description: "登录" },
    ),
  );
  runtime.service(
    "auth.logout",
    defineService(() => sdkClient.auth.logout(), {
      description: "退出登录",
    }),
  );
}
