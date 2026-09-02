import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@engine": src("engine"),
      "@binding": src("binding"),
      "@runtime": src("runtime"),
      "@utils": src("utils"),
      "@app-types": src("runtime/types.ts"),
    },
  },
  test: {
    environment: "happy-dom",
  },
});
