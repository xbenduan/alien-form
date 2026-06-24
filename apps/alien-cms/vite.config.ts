import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^antd$/,
        replacement: resolve(__dirname, "src/vendor/antd/index.tsx"),
      },
      {
        find: /^@ant-design\/icons$/,
        replacement: resolve(__dirname, "src/vendor/ant-design-icons.tsx"),
      },
      {
        find: /^antd\/es\/table$/,
        replacement: resolve(__dirname, "src/vendor/antd/table-types.ts"),
      },
      {
        find: /^antd\/es\/table\/interface$/,
        replacement: resolve(__dirname, "src/vendor/antd/table-types.ts"),
      },
    ],
  },
});
