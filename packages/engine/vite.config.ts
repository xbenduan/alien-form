import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const engineSrc = path.resolve(__dirname, "src");

export default defineConfig({
  root: path.resolve(__dirname, "playground"),
  plugins: [react()],
  resolve: {
    alias: {
      "@alien-form/engine/react": path.resolve(engineSrc, "react/index.ts"),
      "@alien-form/engine": path.resolve(engineSrc, "index.ts"),
    },
  },
});
