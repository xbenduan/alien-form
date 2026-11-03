import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  resolve: { conditions: ["solid", "browser", "development|production"] },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.FORMWORK_SERVICE_PORT ?? "8788"}`,
        changeOrigin: false,
      },
      "/mcp": {
        target: `http://127.0.0.1:${process.env.FORMWORK_SERVICE_PORT ?? "8788"}`,
        changeOrigin: false,
      },
    },
  },
});
