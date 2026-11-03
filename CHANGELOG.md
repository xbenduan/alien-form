# Changelog

## Unreleased

- 将 Formwork 重构为 headless 应用框架，显式注册 apis、components、ui、domains、pages。
- Domain 使用 router 和 render 组合 Records、Detail、Editor；普通 Page 独立注册，应用提供样式与 presenter。
- 增加共享列表和编辑 controller，支持条件查询、分页、直达、未保存守卫、取消及保存后的查询刷新。
- 记录 API 统一返回带模型及记录版本的快照，更新和删除执行双版本条件检查。
- 默认 list 接入完整记录管理；tree-list、videos 和字符串 richtext 保留为简单示例。
- 能力清单改为 app 与显式路由声明，Vite 插件不再改写 JSX；支持直接登记应用能力。
- 删除历史协议转换和数据库升级脚本；开发启动保留数据，dev:reset 显式重置。
- 提供独立内存 API 与 UI 的最小 headless 示例，同步模型管理、预览、HTTP 和 MCP 接入。
