import type { Runtime } from "@alien-form/engine";
import type { LoginResponse } from "@app-types";
import { transport } from "@runtime/transport";

export function registerAuthServices(runtime: Runtime): void {
  runtime.service("auth.login", (body: { username: string; password: string }) =>
    transport.send<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  runtime.service("auth.logout", () =>
    transport.send<void>("/api/auth/logout", { method: "POST" }),
  );
}
