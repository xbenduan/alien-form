import { defineConfig } from '@rspress/core'

export default defineConfig({
  root: 'docs',
  lang: 'en',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'FormBao',
      description: 'Schema-driven form engine powered by Alien Signals',
    },
    {
      lang: 'zh',
      label: '中文',
      title: 'FormBao',
      description: '基于 Alien Signals 的 Schema 驱动表单引擎',
    },
  ],
  title: 'FormBao',
  description: 'Schema-driven form engine powered by Alien Signals',
  icon: '/logo.svg',
  logo: '/logo.svg',
  logoText: 'FormBao',
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/nicepkg/formily-bao',
      },
    ],
    footer: {
      message: 'Released under the MIT License.<br />Copyright 2024-present FormBao Contributors',
    },
    search: true,
    localeRedirect: 'never',
  },
})
