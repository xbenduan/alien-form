import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@alien-form/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@alien-form/react": fileURLToPath(new URL("../../packages/react/src/index.tsx", import.meta.url)),
      "@alien-form/cms": fileURLToPath(new URL("../../packages/cms/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
