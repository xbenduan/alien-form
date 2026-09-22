---
name: "alien-form-model"
description: "Builds, creates, and edits renderable Alien Form models."
---

# Alien Form 模型管理

本 Skill 面向下载时所在的服务 `__ALIEN_FORM_BASE_URL__`。模型协议、Runtime 能力、页面模版和 JSON Schema 均由项目协议源码自动生成。

## 强制流程

1. 先读取 `references/model-schema.json`，它是可提交模型的机器可读协议。
2. 再读取 `references/runtime-components.json`、`runtime-services.json`、`runtime-utils.json` 和 `runtime-enums.json`，只引用其中声明的能力。
3. 读取 `references/page-templates.json` 作为初始 AST。模版仅在创建时展开，之后可以自由增删页面节点、slot、属性和表达式。
4. 以 `templates/model.json` 为起点。每个字段的存储配置与表单表现统一放在 `fields[]` 中。
5. 页面节点通过显式 `slots` 引用同级 `properties` 子节点，不要在 props 中隐式传递节点 key。
6. 页面动作也是 AST 节点：记录跳转使用 `record-action`，自定义行操作使用 `row-button`，批量操作使用 `batch-button`。
7. `{{ ... }}` 表达式可以返回值、函数或异步函数；服务使用 `$service("code")`，工具和枚举分别使用 `$utils.code`、`$enums.code`。
8. 新增使用 `node scripts/model.mjs create <模型文件路径>`，服务端会执行完整协议校验。
9. 编辑时先执行 `node scripts/model.mjs get <模型名> > <模型文件路径>`，再执行 `node scripts/model.mjs update <模型名> <模型文件路径>`。

## 系统字段

`id`、`createdAt`、`updatedAt` 必须保持模板配置：仅详情模式显示、始终只读，并且只进入详情页“系统信息”分组。

## 自由度与边界

- AST 是最终页面协议，模版不是运行时限制。
- 可以删除内置页面或动作，也可以增加启停、导入、导出及业务专属节点。
- 页面特有的短逻辑可直接写入表达式；跨页面复用或涉及事务的逻辑应注册为 Runtime Service。
- 不允许引用能力清单之外的 component、service、utility 或 enum。
- 接口返回非 2xx 时停止，不得自动切换接口或认证方式。

## 接口

连接地址与当前会话凭证只从 `references/connection.json` 读取。编辑必须使用
`PUT /api/v1/models/:name`，不得通过 POST 创建同名模型。
