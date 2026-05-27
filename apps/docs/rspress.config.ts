import { defineConfig } from "@rspress/core";
import { pluginPreview } from "@rspress/plugin-preview";

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
      postcss: {
        postcssOptions: {
          plugins: [require("@tailwindcss/postcss")],
        },
      },
    },
  },
  globalStyles: "./styles/demo.css",
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
