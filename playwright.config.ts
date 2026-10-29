import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

process.env.FORMWORK_E2E_ROOT ??= join(tmpdir(), `alien-form-e2e-${randomUUID()}`);

export default defineConfig({
  testDir: "./apps/client/e2e",
  outputDir: join(tmpdir(), "alien-form-playwright-results"),
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5184",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx scripts/e2e-server.ts",
    url: "http://127.0.0.1:5184",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
