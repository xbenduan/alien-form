# Worker 后端重构决策记录

2026-10-29 确认并实施：模型统一由 Worker/D1 持有，客户端和 MCP 只走 API；开发使用本地 D1，部署使用 Cloudflare D1。完整实现契约见 [后端设计](./backend-system-design.md)，运行与发布步骤见 [开发说明](./formwork-development.md)。

| 确认项 | 最终规则                                                    |
| ------ | ----------------------------------------------------------- |
| Q11    | 先保存共享草稿；只能管理页手动发布                          |
| Q12    | 本地与 Cloudflare D1 使用同一 Worker 代码，所有模型通过 API |
| Q16    | 无必要不兼容旧协议与旧模型 ID，必要数据通过一次性迁移       |
| Q17    | 刷新后更新；旧页提交按当前 schema 返回具体错误，保留输入    |
| Q18    | document、关系、storage 与权限配置统一版本化                |
| Q19    | 删除字段保留物理列和值                                      |
| Q20    | 收紧约束允许旧记录暂时无效，新提交必须有效                  |
| Q21    | 无效草稿可保存并返回诊断，发布时强制有效                    |

Page/Window 显式从 API 加载已发布文档，JSON/Zod 校验后提供 Domain `ctx.schema`；Domain 返回 RuntimeSchema 才用于渲染。加工影响当前实例，不回写定义，不改变后端记录 modelId 或校验。

management revision 与不可变 publish revision 分离。草稿、首次创建和发布通过 D1 batch 的 CHECK guard 保护；发布 DDL/version/head/draft 同事务。记录校验后提交再次断言 active_version，避免并发发布期间按旧规则写入。

metadata 使用 `fw_*`，新活动 migration 与 13 个历史 SQL 分离。删除旧代码包不删除远端旧数据；迁移工具只读 inventory、生成 plan、显式本地 apply 并核对 ID/owner/关系/值摘要。远端 inventory、备份、迁移和实际部署独立执行，不由代码实现或开发启动触发。

真实 D1 tests 和 Chromium E2E 覆盖这些规则；模型文件、来源切换、上传、模型 HMR 和生产快照打包已移除。旧源码分析仅为迁移前历史证据。
