import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspress/core";
import { pluginPreview } from "@rspress/plugin-preview";
import tailwindcss from "@tailwindcss/postcss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "docs",
  lang: "en",
  locales: [
    {
      lang: "en",
      label: "English",
      title: "AlienForm",
      description: "Schema-driven form engine powered by Alien Signals",
    },
    {
      lang: "zh",
      label: "中文",
      title: "AlienForm",
      description: "基于 Alien Signals 的 Schema 驱动表单引擎",
    },
  ],
  title: "AlienForm",
  description: "Schema-driven form engine powered by Alien Signals",
  icon: "/logo.svg",
  logo: "/logo.svg",
  logoText: "AlienForm",
  plugins: [
    pluginPreview({
      defaultRenderMode: "pure",
    }),
  ],
  builderConfig: {
    tools: {
      postcss(config) {
        config.postcssOptions ||= {};
        config.postcssOptions.plugins ||= [];
        config.postcssOptions.plugins.push(tailwindcss());
      },
    },
  },
  globalStyles: path.join(__dirname, "styles/global.css"),
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/xbenduan/alien-form",
      },
    ],
    footer: {
      message:
        "Released under the MIT License.<br />Copyright 2024-present AlienForm Contributors",
    },
    search: true,
    localeRedirect: "never",
  },
});
