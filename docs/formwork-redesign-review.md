# Formwork 重构验收记录

重构已完成开发，最终 API 以[运行时文档](formwork-api-architecture.md)及源码导出为准。此记录替换此前“只讨论设计、尚未开发”的审阅状态。

## 对话要求与实现

| 要求                                       | 实现                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| 框架 headless，app 拥有 UI 和样式          | formwork 不导入客户端组件和 CSS；CMS 与独立示例各自提供映射                  |
| 显式 domains 和 pages                      | defineFormwork 校验两个数组，重复 router 报错                                |
| domains/list、domains/tree、domains/videos | 分目录定义，domains/index 只汇总                                             |
| Domain 使用 router/render                  | 直接映射 `/router/:modelId`，没有 views 配置                                 |
| 原子组合默认详情                           | Records 和 RecordOutlet 使用延迟 Detail/Editor slot                          |
| transformSchema 返回 ctx                   | 克隆 Schema，按 app → Domain → 局部加工；校验返回值和模型身份                |
| list 是正式场景                            | 查询、分页、排序、CRUD、关系、复杂字段、错误及未保存保护                     |
| tree-list/videos 简单示例                  | 当前页父节点分组与记录卡片，共享 controller 和 Detail                        |
| richtext 使用最简单实现                    | 共享 string 契约，Text 多行输入，无专业编辑器                                |
| 不迁移历史数据                             | 删除转换器、升级脚本和迁移文档，只初始化当前协议                             |
| API 必须有用途                             | 保留实际接入的 atom、controller、数据及模型管理 API；去掉 Window 与 JSX 转换 |

## 相对设计草案的收敛

| 草案中的设想                         | 最终选择及原因                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| features、可选记录版本、多级默认权限 | 使用必需快照版本和按字段 capabilities，避免写入条件不明确    |
| 任意操作栈                           | 当前使用单个活动操作，满足默认 list 的打开、取消、保存和直达 |
| 原子化管理页和 CommandAction         | 只有一个实际消费者，保留应用代码                             |
| ArrayItems、RelationPicker           | ArrayHandle 与 app 关系控件已有复用点，不增加包装层          |
| 完整树查询适配器                     | tree-list 仅为示例，明确只处理当前页                         |
| 复杂富文本或内容编码转换             | 字符串加多行输入，符合本次范围                               |
| 强制构建插件                         | 普通 TS/JSX 接入即可，静态能力清单可单独生成                 |
| 历史协议迁移                         | 后续指令明确取消；发布兼容性保护仍保留                       |

## 验证范围

| 验证                 | 覆盖                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Vitest node          | Schema/format/value/query、数据客户端、HTTP、权限、发布、清单、本地 Worker 和开发端口                          |
| Vitest browser       | renderer、scope、Schema 加工、列表与编辑 controller、多个集合、直达、取消、导航                                |
| 10 项 Playwright E2E | 默认 list CRUD/缺失值/null/默认值、筛选与移动布局、预览隔离、模型编辑、dirty guard、记录冲突、直达、密码与角色 |
| 构建及类型           | formwork、Vite 插件、client、service、根目录测试类型和独立示例                                                 |
| lint 与格式          | 全仓库                                                                                                         |
| 本地启动             | 隔离 D1 的完整 dev 启动、health/login、静态能力登记                                                            |
| Worker dry-run       | 静态资源与 Worker 打包，无远端部署                                                                             |

重构验收结果：Vitest 15 个文件、95 项测试全部通过；Playwright 10 项 E2E 全部通过。全仓库 lint、格式、构建和类型检查通过，独立示例类型及构建通过，本地 dev 启动与能力登记通过，Worker dry-run 通过。学习中心另外验证了 390px 和 1440px 宽度、复制 JSON 与问答展开，无页面脚本错误或横向页面溢出。

后续登录问题暴露了重构前本地数据库的复用遗漏：账号与密码哈希相符，但旧记录没有字段存在标记，密码哈希被新版解码器跳过。开发数据已按记录协议放入 `state-records-v1`，保留旧 `state` 与账号文件；新增真实 Worker 启动回归覆盖同一凭证登录及重置后旧目录保留。

执行方式见 README 的 `pnpm check`；独立示例的构建命令见其 README。

## 保留的边界

- tree-list 不提供完整祖先补齐、跨页树加载；videos 不处理媒体。
- 后端仍为 D1；其他后端需实现 FormworkApis，并自行落实权限与条件写入。
- 当前 D1 的 relation/storage 主要作用于根字段，嵌套结构以 JSON 保存。
- 能力清单是静态证据，不能证明任意 transform 的运行结果。
- 不兼容模型发布会拒绝执行；本项目没有自动迁移工具。
- 本次完成本地开发与验收，没有正式部署、发布包或修改外部数据库。
