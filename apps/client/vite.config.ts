import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwind from "@tailwindcss/vite";
import { formworkPlugin } from "formwork-vite-plugin";

export default defineConfig({
  plugins: [
    formworkPlugin({
      entry: "src/formwork.tsx",
      models: ["src/models/**/model.json", "src/domains/**/model.json"],
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
});
