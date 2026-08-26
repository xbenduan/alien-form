# Alien CMS

`alien-cms` 是 AlienForm 的 schema-driven CMS 工作台。它验证一份模型 Schema
如何驱动模型管理、筛选、表格、新增、编辑和详情，同时保持通用 UI 与 CMS
业务协议的边界。

## 架构

项目采用 app + shared 两层架构：

- `@alien-form/shared` 提供通用 adapters，以及表单、筛选、表格和详情场景组件。
  它只接收标准 Schema、projection、handlers 和 actions，不理解 `Cms` 类型、
  `x-model`、`x-cms`、Provider 或 CRUD。
- `apps/alien-cms` 拥有 CMS 业务能力，包括模型类型与 Builder、`x-model` /
  `x-cms` 解释、多场景投影、Provider 契约、本地与 HTTP 数据源、CRUD facade
  和 React Query 业务控制器。

底层由 `@alien-form/core` 提供无头表单运行时，`@alien-form/react` 提供 React
绑定。app 将业务 Schema 投影为通用输入，再交给 shared 渲染。

## 当前能力

- 模型首页、模型创建与编辑、Schema JSON 导入和预览
- 同一份模型 Schema 驱动 filter / table / add / edit / detail
- 叶子字段筛选投影与默认筛选项
- 标量、对象、对象数组和基本类型数组的表格展示
- 新增、编辑、详情、删除、批量删除和列设置
- 本地内存 Demo Provider 与远程 HTTP Provider 切换
- Provider 设置、操作日志和内置示例模型
- 基于 React Router 的模型与记录页面路由

## 目录

```text
apps/alien-cms/src/
  app/                    # 启动、Provider 注入、布局和路由
  components/             # app 专用组件与 handlers
  data/                   # Provider、CRUD facade、本地/HTTP 实现与种子数据
  domains/
    model/                # 模型类型、Builder、Schema 工具和模型页面
    record/               # 业务投影、记录控制器和记录页面
    system/               # Provider 设置、日志和 About 页面
  mock/                   # 应用 mock 入口
  utils/                  # app 通用纯函数

packages/shared/src/
  adapter/                # 通用 adapter registry、catalog 与 scene resolver
  adapters/               # Ant Design 组件适配
  components/             # 页面状态、字段展示、复杂字段详情等应用组件
  scenes/                 # form、filter、table 场景实现
```

## 开发

在仓库根目录执行：

```bash
pnpm --filter @alien-form/alien-cms dev
pnpm --filter @alien-form/alien-cms test
pnpm --filter @alien-form/alien-cms build
```

架构边界检查：

```bash
pnpm check:boundaries
```

## 边界约束

- shared 不定义或导出 CMS 模型、Provider、CRUD 或业务 projection。
- app 不复制 shared 已提供的通用 adapters 和场景组件。
- Provider 与页面之间通过 app data facade 和 domain hooks 交互。
- filter / table / form / detail 投影共用 app 记录域的字段遍历工具。
