import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwind from "@tailwindcss/vite";
import { formworkPlugin } from "formwork-vite-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  define: {
    "import.meta.env.VITE_FORMWORK_MCP_ENTRY": JSON.stringify(
      command === "serve"
        ? fileURLToPath(new URL("./stdio.js", import.meta.resolve("formwork")))
        : "<项目绝对路径>/packages/formwork/dist/stdio.js",
    ),
  },
  plugins: [
    formworkPlugin({
      entry: "src/formwork.tsx",
      appId: "alien-form",
      capabilities: {
        apiUrl: `http://127.0.0.1:${process.env.FORMWORK_SERVICE_PORT ?? "8788"}/api/v1`,
        token: () => process.env.FORMWORK_CAPABILITY_TOKEN,
        clientOrigin: process.env.FORMWORK_CLIENT_ORIGIN,
      },
    }),
    solid(),
    tailwind(),
  ],
  resolve: { conditions: ["solid", "browser", "development|production"] },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.FORMWORK_SERVICE_PORT ?? "8788"}`,
        changeOrigin: false,
      },
    },
  },
}));
