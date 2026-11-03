import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        model: "src/model/index.ts",
        mcp: "src/mcp/index.ts",
        data: "src/data/index.ts",
        atom: "src/atom/index.ts",
      },
      formats: ["es"],
    },
    rolldownOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("\0"),
      output: { entryFileNames: "[name].js" },
    },
  },
});
