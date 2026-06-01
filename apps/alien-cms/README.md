# Alien CMS

## 中文

### 项目简介

`alien-cms` 是一个基于 `alien-form` 的 schema-driven CMS 工作台验证项目。

它的目标不是实现完整商业 CMS，而是验证一份业务 schema 是否可以同时驱动以下后台场景：

- 筛选 `Filter`
- 列表 `Table`
- 新增 `Add`
- 编辑 `Edit`
- 详情 `Detail`

当前项目运行在 `apps/alien-cms`，使用本地 `Dexie.js + IndexedDB` 作为数据层，并通过统一的 provider/repository 暴露出接近接口请求的调用方式。

### 当前特性

- 单页式模型工作台，不依赖 `react-router`
- 通过 URL 切换模型，当前协议为 `/models/:model`
- schema 自动加载自 `schema/*.json`
- 同一份 schema 驱动 `filter / table / add / edit / detail`
- `filter` 使用 `alien-form` 查询 adapters 渲染
- `detail` 使用 `alien-form` 只读 adapters 渲染
- `table` 使用 Ant Design `Table` 作为网格容器，并支持：
  - 标量字段 cell 渲染
  - 复杂 `object / void / array` 字段摘要
  - 字段级详情 icon
  - 单字段居中弹窗详情
- 本地模型数据持久化到浏览器 IndexedDB

### 技术栈

- React 18
- TypeScript
- Vite
- Ant Design 5
- `@alien-form/react`
- `@tanstack/react-query`
- Dexie.js
- dayjs

### 目录结构

```txt
apps/alien-cms/
  schema/                      # 模型 schema
    article.json
    campaign.json
  src/
    app/                       # 应用 providers 与轻量 model route
    adapters/                  # form/filter/detail adapters
    core/
      projection/              # filter/table/form/detail projection
      schema/                  # schema loader 与 normalize
    data/
      db/                      # Dexie 数据库与种子数据
      provider/                # 对页面暴露的数据访问接口
      repository/              # Dexie 查询封装
    hooks/
      use-model-page.ts        # 页面状态中心
    pages/model/               # ModelPage / Filter / Table / Drawer
    types/
```

### 运行方式

在仓库根目录执行：

```bash
pnpm --filter @alien-form/alien-cms dev
```

构建：

```bash
pnpm --filter @alien-form/alien-cms build
```

预览：

```bash
pnpm --filter @alien-form/alien-cms preview
```

### 模型访问

当前内置两个模型：

- `article`
- `campaign`

默认会进入第一个可用模型，也可以直接通过 URL 进入：

```txt
/models/article
/models/campaign
```

项目没有引入 `react-router`，而是使用 `window.history.pushState` 和 `popstate` 实现最小路由能力。

### 核心设计

#### 1. Single Schema, Multi-View

同一份 schema 负责驱动多个视图场景，而不是为每个视图手写一套配置。

#### 2. 场景化 Adapter

不同场景使用不同 adapters，而不是把一个编辑组件强行切成多种模式：

- `form adapters`：新增 / 编辑
- `filter adapters`：查询表单
- `detail adapters`：只读展示
- `table cell renderer`：表格单元格内容摘要

#### 3. 表格复杂字段策略

表格保留 Ant Design `Table` 作为二维布局容器。

对于复杂字段：

- `object / void / array` 先在单元格中显示摘要
- 如果字段可展开，则显示一个 icon
- 点击后弹出单字段详情弹窗
- 弹窗内部再使用 `alien-form` 的只读 schema 渲染完整内容

#### 4. 数据层解耦

页面不会直接操作 Dexie，而是统一通过：

- `provider`
- `repository`

这保证了后续可以在不改页面层的前提下，将本地数据层替换成远端 API。

### 已验证能力

- 模型切换
- 筛选查询
- 分页 / 排序
- 新增 / 编辑 / 删除
- 行级详情
- 字段级复杂详情
- `object / void / array` 的 schema 驱动渲染

### 当前限制

- 当前主要面向桌面端
- 暂未接入真实后端
- 暂未实现权限、多模型配置平台、导入导出等平台能力
- 构建产物体积仍有优化空间

---

## English

### Overview

`alien-cms` is a schema-driven CMS workbench built on top of `alien-form`.

Its goal is not to ship a production-ready CMS, but to validate whether one business schema can drive multiple back-office views at the same time:

- `Filter`
- `Table`
- `Add`
- `Edit`
- `Detail`

The app lives in `apps/alien-cms` and uses `Dexie.js + IndexedDB` as a local persistence layer, exposed through a provider/repository abstraction that mimics API-style access.

### Features

- Single-page model workbench without `react-router`
- Model switching via URL using `/models/:model`
- Automatic schema loading from `schema/*.json`
- One schema drives `filter / table / add / edit / detail`
- `filter` is rendered by `alien-form` query adapters
- `detail` is rendered by `alien-form` read-only adapters
- `table` keeps Ant Design `Table` as the grid container and supports:
  - scalar cell rendering
  - summary rendering for `object / void / array`
  - field-level detail icon
  - centered modal for single-field detail
- Local records are persisted in browser IndexedDB

### Tech Stack

- React 18
- TypeScript
- Vite
- Ant Design 5
- `@alien-form/react`
- `@tanstack/react-query`
- Dexie.js
- dayjs

### Project Structure

```txt
apps/alien-cms/
  schema/                      # model schemas
  src/
    app/                       # providers and lightweight model routing
    adapters/                  # form/filter/detail adapters
    core/
      projection/              # filter/table/form/detail projections
      schema/                  # schema loading and normalization
    data/
      db/                      # Dexie database and seeds
      provider/                # page-facing data provider
      repository/              # Dexie data access implementation
    hooks/
      use-model-page.ts        # page state controller
    pages/model/               # page shell and model UI pieces
    types/
```

### Getting Started

Run from the monorepo root:

```bash
pnpm --filter @alien-form/alien-cms dev
```

Build:

```bash
pnpm --filter @alien-form/alien-cms build
```

Preview:

```bash
pnpm --filter @alien-form/alien-cms preview
```

### Available Models

The app currently ships with two built-in models:

- `article`
- `campaign`

You can access them directly by URL:

```txt
/models/article
/models/campaign
```

Instead of using `react-router`, the app implements minimal routing with `window.history.pushState` and `popstate`.

### Core Ideas

#### 1. Single Schema, Multi-View

The same schema should drive multiple views, instead of maintaining separate configurations for each screen.

#### 2. Scenario-Specific Adapters

Each scenario uses its own adapter set:

- `form adapters` for add/edit
- `filter adapters` for search forms
- `detail adapters` for read-only views
- `table cell renderers` for table summaries

#### 3. Complex Field Strategy In Table

The table remains a grid container powered by Ant Design `Table`.

For complex fields:

- `object / void / array` first render as summaries in a cell
- expandable fields show an icon
- clicking the icon opens a single-field detail modal
- the modal content is rendered again by `alien-form` using a read-only schema

#### 4. Data Layer Decoupling

Pages never talk to Dexie directly.

All data access goes through:

- `provider`
- `repository`

This keeps the page layer stable if the local data source is replaced by a real backend later.

### What Has Been Validated

- model switching
- search filters
- pagination and sorting
- add / edit / delete
- row-level detail
- field-level complex detail
- schema-driven rendering for `object / void / array`

### Current Limitations

- desktop-first UI
- no real backend yet
- no permission system or schema management platform yet
- bundle size still has room for optimization
