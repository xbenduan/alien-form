# Schema 协议重构 Plan

> 本 plan 汇总本轮已锁定的协议决策与落地改造点。**`scope`（跨组件通信频道 / 发布订阅）的设计尚未定稿，不在本 plan 范围内**，另行讨论。

## 一、背景与目标

将页面协议从"engine 编译期 marker（`{plugin:"$af-xxx"}`）+ core 表单期 `{{ }}`"两套并存的表达式体系，收敛为**单一表达式体系 + 单一静态引用体系**，并把运行时能力（service / utils / enums / query）统一注入页面运行时，让"使用者写 schema、开发者写代码"彻底分离。

## 二、已锁定决策

### 1. 表达式与引用体系（双关键字，各司其职）

| 关键字 | 语义 | 实现 | 出现位置 | 约束 |
|---|---|---|---|---|
| `{{ }}` | 运行时求值 | `new Function` | slots / props / 字段规则 | 隐式包成 `() => (expr)`；含 `=>` 即函数工厂 |
| `$ref` | 静态结构引用 | 复用 core 现有 `resolveSchemaTree`（含循环检测） | 只指向 `definitions` | **永不含表达式** |

- `{{ }}` 用 `new Function` 实现：schema 由框架自建、无用户提交入口（构建模型功能使用者不可用），信任模型成立。
- 求值器实现注意（不影响协议，仅影响体验）：
  - 按表达式字符串 memo 编译结果，避免每次渲染 `new Function`。
  - 抛错时把原始表达式串 + schema 路径包进错误信息，便于定位。

### 2. 命名空间（注入页面运行时，`{{ }}` 内可用）

| 命名空间 | 类型 | 说明 |
|---|---|---|
| `$service(code)` | 异步 | 服务工厂，返回可调用函数（改为 lazy factory，见下） |
| `$utils.xxx` | 同步纯函数 | 需把现有 `registry.functions` / `runtime.fn` 骨架**做实** |
| `$enums.xxx` | 同步常量 | 由现有 `constant` **整体改名**而来 |
| `$query.xxx` | 同步读 URL | 当前页 URL 查询参数，注入运行时作用域 |

### 3. 两层作用域（明确边界）

- **页面运行时 = 整个页面**：承载 `$service` / `$utils` / `$enums` / `$query`，`{{ }}` 在 renderer 求值。**这是新增的核心层。**
- **`useCreateForm` = 仅表单块内部**：承载字段规则的 scope / handlers（如 [model-meta-form.tsx:160](file:///Users/bytedance/Documents/cowork/alien-form/apps/alien-mdm/src/domains/model/components/model-meta-form.tsx#L160)）。表单块挂在页面运行时之下，可继承页面能力。

### 4. `constant` → `enums` 整体改名

纯机械改名，波及：
- `runtime.constant()` → `runtime.enums()`
- `PageScope.constant` → `PageScope.enums`
- marker `$af-constant` → `$af-enums`（[constant.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/plugins/constant.ts)）
- 注册文件 [constant.ts](file:///Users/bytedance/Documents/cowork/alien-form/apps/alien-mdm/src/register/global/constant.ts)
- 引用点：`model-codec.ts` 里 `{plugin:"$af-constant", key:"status"}`

### 5. 删除自研求值器，统一 `{{ }}` 引擎

- 删除 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts)（自研安全求值器）。
- [form.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts) 中 `isExpression` / `extractExpression` / `executeRuntimeValue` / `buildExpressionScope` 改为调用统一的 `new Function` 求值器。
- 表单字段规则（x-reaction / effect / format / validate）与页面层共用**同一个** `{{ }}` 引擎，不再有两套。

### 6. 路由

- 只用**静态路径段**，形如 `{modelCode}/list`、`{modelCode}/add`、`{modelCode}/edit`，`{modelCode}` 是固定路径、非运行时参数。
- list → detail 的 id **不预声明**：详情按钮直接把 `row.id` 作为入参传入。
- URL 上的 query 注入运行时作用域，命名 **`$query`**（复用现有 `PageScope.query` key；不用 `$search`，避免与 `location.search` 原始查询串语义混淆）。

### 7. `useScope` 数据 Hook（注：此处指"取数/能力"用途，与待定的"通信频道 scope"是不同概念，命名后续需消歧）

- 统一入口，成员名即缓存 key。
- **声明两者并存分工**：
  - 简单直取 → 纯对象：`{ service: "list" }` / `{ enums: "status" }` / `{ utils: "buildMenuTree", args: {...} }`（可视化配置友好）。
  - 含加工 / 组合 → `{{ }}` 表达式：`"{{ (p) => $service('detail')({ ...p, t: $utils.test(p) }) }}"`。
  - 内部统一归一成 **lazy factory**（声明期不执行）。
- **返回值按命名空间分流**：
  - `service` → `{ data, loading, refetch }`（内部 `useQuery([name, args], ...)`）。
  - `utils` → 可调用函数 / 直接算出的值。
  - `enums` → 常量值。
  - `query` → URL 查询值（URL 变触发 re-render）。
- **禁止**把 `utils`/`enums`/`query` 硬套 `{data,loading}` 异步外壳（loading 恒 false 会导致语义失真）。

### 8. Query Cache（filter ↔ table 刷新机制）

- **方案 A（选定）**：基于 alien-signals 自建轻量 query cache，**不引入 TanStack Query**（避免两套响应式内核并存，与现有 [list.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/page/blocks/list.ts) 的 signal 模型同源）。
- 刷新两条路径：
  1. **筛选 / 翻页 / 排序**：params 进 key → key 变 → 自动 refetch。
  2. **删除 / 新增后 / 手动刷新按钮**：`invalidate(key)` / `refetch()` 强制重拉。
- **成员名即缓存 key**，不单设 key 体系。

> 备注：filter↔table 之间"params 存哪"（页面级 signal vs URL `$query`）以及跨组件通信模型，归入待定的 scope 讨论。

## 三、落地改造清单（施工顺序）

1. **页面运行时扩展能力门面**：`PageScope` 增补 `$service`（改 lazy factory）/ `$utils` / `$enums` / `$query`（[scope.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/page/scope.ts)、[runtime.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/page/runtime.ts)）。
2. **renderer 插入 `{{ }}` 求值**：透传 `node.props` / `slots` 前对表达式求值（[renderer.tsx](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/renderer.tsx)）。
3. **统一表达式引擎**：新建 `new Function` 求值器 → 删除 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts) → 改造 [form.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts) 相关调用。
4. **`constant` → `enums` 改名**：全链路机械替换（见决策 4 波及面）。
5. **做实 `$utils` / `runtime.fn`**：补注册与调用链路（现为骨架、全仓无调用）。
6. **`useScope` 实现**：声明解析（对象 / `{{ }}` 归一 lazy factory）+ 按命名空间分流返回 + signal query cache。
7. **`x-pages` + 静态路由落地**：多页面收口进 schema，对接现有 React Router / engine RouterAdapter。

## 四、待定（不在本 plan）

- `scope` 作为**跨组件通信频道 / 发布订阅**的设计（`emit` / `on` 语义、频道在 schema 顶层如何声明、频道传"参数"还是"数据"、与现有 PageBus 及 ListBlock 共享 atom 模型的关系、与 `useScope` 取数 Hook 的命名消歧）。
