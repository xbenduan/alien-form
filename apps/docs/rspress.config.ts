import { defineConfig } from "rspress/config";
import containerSyntax from "@rspress/plugin-container-syntax";

export default defineConfig({
  root: "docs",
  title: "Alien Form",
  description: "Schema-driven form runtime and flagship CMS scenario.",
  icon: "/logo.svg",
  logo: {
    light: "/logo.svg",
    dark: "/logo.svg",
  },
  lang: "en",
  locales: [
    {
      lang: "en",
      label: "English",
      title: "Alien Form",
      description: "Schema-driven form runtime.",
    },
    {
      lang: "zh",
      label: "简体中文",
      title: "Alien Form",
      description: "Schema 驱动的表单运行时。",
    },
  ],
  plugins: [containerSyntax()],
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/xbenduan/alien-form",
      },
    ],
    locales: [
      {
        lang: "en",
        label: "English",
        outlineTitle: "On this page",
        prevPageText: "Previous",
        nextPageText: "Next",
        searchPlaceholderText: "Search docs",
        searchNoResultsText: "No results",
        searchSuggestedQueryText: "Please try again with a different keyword",
      },
      {
        lang: "zh",
        label: "简体中文",
        outlineTitle: "本页目录",
        prevPageText: "上一页",
        nextPageText: "下一页",
        searchPlaceholderText: "搜索文档",
        searchNoResultsText: "未找到结果",
        searchSuggestedQueryText: "请尝试更换关键词",
      },
    ],
  },
});
