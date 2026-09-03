import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@binding": src("binding"),
      "@runtime": src("runtime"),
      "@utils": src("utils"),
      "@app-types": src("runtime/types.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.API_TARGET ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
