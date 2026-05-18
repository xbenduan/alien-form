import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FormBao',
  description: 'Schema-driven form engine powered by Alien Signals',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'API', link: '/api/core' },
          { text: 'Advanced', link: '/advanced/linkage' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/guide/getting-started' },
                { text: 'Tutorial', link: '/guide/tutorial' },
              ],
            },
          ],
          '/api/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Core', link: '/api/core' },
                { text: 'Schema', link: '/api/schema' },
                { text: 'Components', link: '/api/components' },
              ],
            },
          ],
          '/advanced/': [
            {
              text: 'Advanced',
              items: [
                { text: 'Field Linkage', link: '/advanced/linkage' },
                { text: 'Array Fields', link: '/advanced/array-fields' },
                { text: 'Layout', link: '/advanced/layout' },
                { text: 'Async Data Source', link: '/advanced/async-datasource' },
                { text: 'Custom Components', link: '/advanced/custom-components' },
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
