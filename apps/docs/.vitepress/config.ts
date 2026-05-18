import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FormBao',
  description: 'Schema-driven form engine powered by Alien Signals',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  locales: {
    root: {
      label: 'Home',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'English', link: '/en/' },
          { text: '中文', link: '/zh/' },
        ],
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'API', link: '/en/api/core' },
          { text: 'Advanced', link: '/en/advanced/linkage' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/en/guide/getting-started' },
                { text: 'Tutorial', link: '/en/guide/tutorial' },
                { text: 'Protocol Design', link: '/en/guide/protocol' },
              ],
            },
          ],
          '/en/api/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Core', link: '/en/api/core' },
                { text: 'Schema', link: '/en/api/schema' },
                { text: 'Components', link: '/en/api/components' },
              ],
            },
          ],
          '/en/advanced/': [
            {
              text: 'Advanced',
              items: [
                { text: 'Field Linkage', link: '/en/advanced/linkage' },
                { text: 'Array Fields', link: '/en/advanced/array-fields' },
                { text: 'Layout', link: '/en/advanced/layout' },
                { text: 'Async Data Source', link: '/en/advanced/async-datasource' },
                { text: 'Custom Components', link: '/en/advanced/custom-components' },
                { text: 'Enterprise Security', link: '/en/advanced/enterprise-security' },
              ],
            },
          ],
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: 'API', link: '/zh/api/core' },
          { text: '进阶', link: '/zh/advanced/linkage' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '介绍',
              items: [
                { text: '快速开始', link: '/zh/guide/getting-started' },
                { text: '教程', link: '/zh/guide/tutorial' },
                { text: '协议设计', link: '/zh/guide/protocol' },
              ],
            },
          ],
          '/zh/api/': [
            {
              text: 'API 参考',
              items: [
                { text: '核心', link: '/zh/api/core' },
                { text: 'Schema', link: '/zh/api/schema' },
                { text: '组件', link: '/zh/api/components' },
              ],
            },
          ],
          '/zh/advanced/': [
            {
              text: '进阶',
              items: [
                { text: '字段联动', link: '/zh/advanced/linkage' },
                { text: '数组字段', link: '/zh/advanced/array-fields' },
                { text: '布局', link: '/zh/advanced/layout' },
                { text: '异步数据源', link: '/zh/advanced/async-datasource' },
                { text: '自定义组件', link: '/zh/advanced/custom-components' },
                { text: '企业安全实践', link: '/zh/advanced/enterprise-security' },
              ],
            },
          ],
        },
      },
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nicepkg/formily-bao' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present FormBao Contributors',
    },
    search: {
      provider: 'local',
    },
  },
})
