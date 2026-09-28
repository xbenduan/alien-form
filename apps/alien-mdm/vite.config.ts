import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@runtime": src("runtime"),
      "@utils": src("utils"),
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
