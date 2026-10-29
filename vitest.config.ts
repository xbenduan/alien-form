import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import { playwright } from "@vitest/browser-playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  test: {
    attachmentsDir: join(tmpdir(), "alien-form-vitest-attachments"),
    projects: [
      {
        test: {
          name: "node",
          include: [
            "packages/formwork/src/model/**/*.test.ts",
            "packages/formwork/src/mcp/**/*.test.ts",
            "packages/vite-plugin/src/**/*.test.ts",
            "apps/service/src/**/*.test.ts",
            "scripts/**/*.test.mjs",
          ],
        },
      },
      {
        plugins: [solid()],
        optimizeDeps: { entries: ["packages/formwork/src/router/**/*.test.tsx"] },
        resolve: { conditions: ["solid", "browser", "development|production"] },
        test: {
          name: "browser",
          include: [
            "packages/formwork/src/runtime/**/*.test.tsx",
            "packages/formwork/src/render/**/*.test.tsx",
            "packages/formwork/src/router/**/*.test.tsx",
          ],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
          },
        },
      },
    ],
  },
});
