# Alien-Form 系统重构分析：core ← engine ← react

> 从零构建的目标架构分析。基于对现有 `packages/core`、`packages/engine`、`packages/react` 的实际代码调研，以及本轮已锁定的页面协议。

---

## 0. 结论速览

| 维度 | 决策 |
|---|---|
| 依赖方向 | `core ← engine ← react`（当前 engine→react 是**反的**，本次倒转） |
| core | **保留但有精简改动**（仍纯逻辑、仅依赖 alien-signals、零 React/DOM）：内置 `compileExpr`（`new Function`）取代自研受限求值器、rule 调用统一为单参 `(scope)`、删 `@handler`、收紧表达式 scope 为闭合形状、移除 `dataSourcePolicy`（改由组件 props）。详见 §1.1 |
| engine | 纯逻辑框架大脑 = `engine/compiler`（构建时）+ `engine/runtime`（运行时）+ `engine/builder`（吸收 `packages/builder`）；**删除 blocks/PageScope/PageBus/ListBlockRuntime；删除整个 `packages/builder`，核心并入 engine** |
| react | **删除重写**：吸收现有 form 桥接 + 从 engine 搬入的运行时桥接 + builder 的 React 绑定，成为唯一 React 层 |
| page 模型 | **一个 page = 一个 core form**（纯 form 模型） |
| compiler 产物 | **预编译成"可执行页面模型"**（表达式已编译成函数、$ref 已展开） |
| 表达式 | `{{ }}` 唯一，`new Function` 编译；编译器 `compileExpr` **归属 core**，engine 构建期复用它做 AOT 预编译；删除 core 自研受限求值器 |
| 命名空间访问 | 四大命名空间统一 **对象/属性访问**：`$service.xxx(params)` / `$utils.xxx()` / `$enums.xxx` / `$query.xxx`（点访问优于 `$service('code')(p)` 的函数-取-函数形式） |
| 通信模型 | **彻底放弃 scope（跨组件通信频道）**，一切联动走 `form + $values`（signal 响应式） |
| 组件策略 | **antd 优先**：antd 组件全量注入 `FormRenderer.components`；布局/展示（Flex/Space/Card…）直接用 antd；仅"调接口"类业务操作才写自研组件 |
| $ref | 纯引用语义（不覆盖，有差异另建 definition），复用块放 `properties`，前缀 `#/definitions/` |
| app 分层 | `apps/alien-mdm/src/domains/model` **只放 UI**；codec/page-builder/commands/types 等核心逻辑全部迁入 engine；`src/compiler`（已空）与 `src/runtime` 全量重写为薄 app 装配 |

---

## 1. 三层职责与依赖契约

### 1.1 `@alien-form/core`（保留）

纯逻辑内核，已验证零 React/DOM 依赖，唯一依赖 alien-signals。engine 依赖它的契约面：

- `createForm(FormConfig): FormInstance` —— 每个 page 就是一个 form。
- `FormConfig.{schema, definitions, scope, initialValues, onError}` —— `scope` 是注入 `$service/$utils/$enums/$query` 命名空间的天然缝（**注意：这是"命名空间注入缝"，不是被删掉的那个跨组件通信频道 scope**，见下 §改动5）。
- `resolveSchemaTree(schema, definitions)` —— $ref 展开 + 循环检测（前缀 `#/definitions/`，仅递归 `properties`/`items`）。
- `FormInstance.{values, fields, field, get, set, mount, unmount, scope, effect}` —— 基于 alien-signals 的响应式。
- 转发的 signal 原语（`signal/computed/effect`），供 react 桥接层用，无需直接依赖 alien-signals。

**core 本轮改动清单**（比"仅删 expression.ts"更完整；#1/#2 是架构自洽必需，#3/#4 是"打破式"清理，#5 是命名纪律）：

1. **compiler 归属 core，core 自洽**（最关键）。`new Function` 编译器 `compileExpr(raw) => (scope)=>unknown` **放 core**——理由：`core + react` 必须能独立搭出表单渲染器，若编译器在 engine，一份含 `{{ }}` 的 schema 脱离 engine 就是死的，core 便不自洽。故 core 同时具备"编译"与"执行"能力；engine/compiler **不再自造第二套编译器**，只是在构建期**调用 core 的 `compileExpr`** 做预编译（AOT）并把结果缓存进 `CompiledApp`。同一原语、两个调用方：core 运行时按需编译（惰性 + astCache 换成 fnCache），engine 构建时提前编译，零重复。现状 core 自带的运行时解析（[executeRuntimeValue](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L845-L850) + [expression.ts:35-46](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts#L35-L46) 的 `astCache`）替换为 `compileExpr` 缓存；`SchemaRuntimeValue` 允许直接接收已编译的 `CompiledExpr`（engine 预编译产物走这条），也允许原始 `{{ }}` 串（core 独立使用时现场 `compileExpr`）。**整包删除旧 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts)**（受限 parser + FORBIDDEN 集合在 `new Function` 信任模型下全废），换成极薄的 `compileExpr`。
2. **统一 rule 调用约定为单参 `(scope)`**。现状 [executeRuntimeValue](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L844-L864) 有两套不兼容签名：函数 rule 走 `rule(runtime, ctx.form)`，字符串走 `evaluateExpression(expr, buildExpressionScope(...))`。编译后的 `{{ }}` fn 要的是 scope 对象；`$form`/`$self` 本就在 scope 里，`(runtime, form)` 冗余。全部收敛到 `(scope)=>value` 一种签名，删掉整条分支。
3. **删除 `@handler` 字符串机制**。[executeRuntimeValue:851-864](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L851-L864) 把 `"@name"` 解析到 `config.handlers`；`{{ }}`-only 协议下它是死重（handler 即 `{{ $utils.name }}`）。删 `@handler` 路径与 `FormConfig.handlers` 字段，`SchemaRuntimeValue` 收敛为 `CompiledExpr | 原始 {{ }} 串 | literal`。
4. **收紧 `buildExpressionScope`：不再把 values/兄弟字段扁平上浮到顶层**。现状 [buildExpressionScope:894-908](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L894-L908) 把 `...values` 与兄弟/父级子字段 spread 成顶层裸标识符（Formily 式 `{{ fieldName }}`）。新协议一律 `{{ $values.x }}` 读；保留扁平上浮会与 `$service`/`$utils` 命名冲突，且 `new Function` body 无法安全解构开放标识符集。改成**显式闭合形状**：`{ $values, $self, $form, $value, $row, $path, $service, $utils, $enums, $query }`（后四者来自 `config.scope`），去掉顶层 `...values`/兄弟 spread，使 `new Function` 解构列表稳定，且契合"统一点访问"。
5. **`config.scope` 保留为注入缝，明确其语义**。本轮删的是"跨组件通信频道 scope"；core 的 `FormConfig.scope` 是另一回事——engine（或 core 的独立使用者）用它注入 `$service/$utils/$enums/$query`。保留，但在类型/文档上把两者区分清楚，避免混淆。
6. **移除 `dataSourcePolicy`**。现状 core 自带"选项变化时如何处置已选值"的策略（`preserve/clear/filter/first`，[form.ts:105-126](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L105-L126) + [types.ts:35](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/types.ts#L35)）。这是**组件呈现策略**，不该内建在 core——删 `DataSourcePolicy` 类型、`FormConfig`/`IFieldSchema.dataSourcePolicy` 字段、`applyDataSourcePolicy`/`isSelectableFieldValueValid`（[form.ts:101-126](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L101-L126)）及其调用点（[form.ts:191](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L191)、[:262](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L262)）。core 只保留 `dataSource` 信号本身；"父变清子/保留/取第一个"由 Select 组件用自己的 props（如 `onOptionsChange:"preserve"|"clear"|"first"`）实现。

> **依赖方向不变**：编译器放 core 不会让 core 反向依赖任何东西——`compileExpr` 只依赖 `new Function`。engine 反过来复用 core 的编译器，方向仍是 `core ← engine`。收益：`core + react` 单栈即可渲染带表达式的 schema，engine 只是加上"构建期预编译 + 路由 + 注册中心"的增强层。现有受限求值器**从设计上禁止函数调用**（[expression.ts:67](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts#L67)），而新协议全是 `{{ (p)=>$service.x(p) }}` 这类函数工厂，本就跑不了——这是删它的根因。

### 1.2 `@alien-form/engine`（重写为纯逻辑）

框架大脑，**无 React**（保留现有 [check-boundaries.mjs](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/scripts/check-boundaries.mjs) 的约束并加强到全包）。两个明确子域：

```
packages/engine/src/
├── compiler/              # 构建时：schema → 可执行页面模型
│   ├── compile.ts         #   编译主流程
│   ├── expression.ts      #   AOT 预编译：批量调 core.compileExpr（编译器本体在 core），缓存进产物
│   ├── ref.ts             #   $ref 展开（委托 core resolveSchemaTree）
│   ├── router.ts          #   x-pages / router 静态路径解析
│   └── types.ts           #   CompiledApp / CompiledPage 契约
├── runtime/               # 运行时：页面实例
│   ├── app-runtime.ts     #   AppRuntime（注册中心 + 编译入口 + 路由）
│   ├── page-runtime.ts    #   PageRuntime（= 装配一个 core form）
│   ├── scope.ts           #   作用域装配：$service/$utils/$enums/$query/$values
│   └── router.ts          #   运行时路由匹配（静态段）
├── registry/              # 组件/service/utils/enums 注册表（保留现有 namespace 两级）
├── builder/               # 吸收 packages/builder：BuilderRuntime + History + command dispatch（纯逻辑，复用 engine 的 store/atom，不再自带 SignalAtom）
│   ├── runtime.ts         #   BuilderRuntime<TDocument>（document/selection/dirty/errors/saving + undo/redo）
│   ├── history.ts         #   History<T> undo/redo 栈
│   ├── command.ts         #   Command / CommandHandler / CommandMap + executeCommand
│   └── model/             #   从 alien-mdm 迁入的 MDM 核心：ModelCodec / model-page-builder / modelCommands / types
└── protocol/              # 协议类型（XPage/FieldSchema/BuilderSchema）+ golden schema
```

**删除**（纯 form 模型下变冗余）：`page/blocks/*`（list/form/detail/custom）、`BlockSchema`、`PageScope`（旧的能力门面）、`PageBus`、`SharedShelf`、`ListBlockRuntime`。它们的职责被"一个 form + `$values` 联动 + 组件内部自取数据"接管。

**吸收 `packages/builder`（整包删除）**：builder 已是纯逻辑、React-free 的 `BuilderRuntime`+`History`+命令派发，唯一外部依赖是 engine 的 `Registry` 类型——核心搬进 `engine/builder`，复用 engine 现成的 `store/`（atom）而非 builder 私有的 `SignalAtom`；builder 的 `./react` 绑定（`BuilderProvider`/`useBuilder`/`useBuilderAtom`/`useCommand`）迁入 react 层。`apps/alien-mdm/src/domains/model/builder/*` 里的 MDM 核心逻辑（`ModelCodec`、`model-page-builder`、`modelCommands`、`types`，以及现困在 [field-editor.tsx](file:///Users/bytedance/Documents/cowork/alien-form/apps/alien-mdm/src/domains/model/components/field-editor.tsx#L105-L166) 里的 `fieldEditorValuesOf`/`fieldEditorSchemaOf` 纯映射函数）一并迁入 `engine/builder/model`；其中 MDM 专属默认约定（审计列、`records.*`/`schema.*` service code、`main`/`form`/`filter` 块名、`record-page`/`overlay` 布局名）通过**注入**而非硬编码进 engine。

**保留复用**：`registry/`（两级 namespace）、`router/`（RouterAdapter 接口 + MemoryRouterAdapter）、`store/`（运行时页面级 atom + 供 builder 复用）、`compiler/walker.ts`（路径读写工具）。

### 1.3 `@alien-form/react`（删除重写）

唯一 React 桥接层，依赖 engine。由三部分合并而成：

1. **form 桥接**（吸收现有 [packages/react/src/index.tsx](file:///Users/bytedance/Documents/cowork/alien-form/packages/react/src/index.tsx)）：`FormRenderer` / `SchemaField` / FieldSlot 家族 / `useField*` / `useForm` / `useCreateForm` / `FormContext`。这套是成熟实现，**吸收而非重写**。`FormRenderer.components` **全量注入 antd 组件**（见 §5）。
2. **运行时桥接**（从 engine 的 [src/react/*](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/renderer.tsx) 搬入并重写）：`PageProvider` / `usePage` / `useRouter` / 页面渲染入口 / `useAtom`（signal→React 的 `useSyncExternalStore` 桥）。
3. **builder 桥接**（从删除的 `packages/builder/react` 搬入）：`BuilderProvider` / `useBuilder` / `useBuilderAtom` / `useCommand`——供 alien-mdm 的 model builder UI 使用。

`packages/react/package.json` 新增 `@alien-form/engine` 依赖。engine 侧删除 `src/react/`、删除 `./react` 子入口、`package.json` 移除 `@alien-form/react`——**反向依赖就此断开**。`packages/builder` 整包删除后，其消费方（alien-mdm）的 import 从 `@alien-form/builder` + `@alien-form/builder/react` 收敛到 `@alien-form/engine` + `@alien-form/react`。

---

## 2. 页面协议（本轮定稿）

一切皆 alien-form 字段，`type` 决定数据行为：

| 维度 | 规则 |
|---|---|
| 页面单元 | `x-page = { router, layout?, schema }`，`schema` 就是一份 alien-form |
| 数据行为 | 非 void = 收值输入源（onChange 写 `$values`）；`type:"void"` = 布局/展示/操作容器，不占 `form.values` |
| 组件联动 | 输入源写 `$values.x` → 消费方 `{{ $values.x }}` 读，纯 signal 响应式 |
| 布局 | 具名插槽（`layout.props` / 容器 props），值为同级 `properties` 字段名；省略 layout 默认 pageCard |
| 业务数据 | props 里 `{{ $service.xxx }}` / `{{ $utils.xxx }}`，返回**未调用**的函数，组件内部自行调用；需内联调用时 `{{ $service.xxx(params) }}` |
| filter 值 | `$values` 里存字符串化 JSON；**不引入 `x-format:"json"` 简写**，消费方（table 组件）内部直接 `JSON.parse` 即可（core 已有 `x-format` 的 `input`/`output` 变换钩子，无需专门的 json 语法糖） |
| 表达式 | `{{ }}` 唯一，`new Function`，隐式 `()=>expr`，含 `=>` 即函数工厂 |
| 静态引用 | `$ref` 唯一，纯引用（不覆盖），前缀 `#/definitions/`，复用块放 `properties` |
| 命名空间 | 统一点访问：`$service.xxx`（dotted code 走两级 Proxy，如 `$service.records.list`）/ `$utils.xxx` / `$enums.xxx`（原 constant 改名）/ `$query.xxx` / `$values` |
| 已删除 | scope（跨组件通信频道，联动全走 form+$values）、发布订阅、x-model、$props、blocks |

golden schema 见 [schema.tsx](file:///Users/bytedance/Documents/cowork/alien-form/schema.tsx)。

---

## 3. 编译时（engine/compiler）：预编译成可执行模型

**输入**：`BuilderSchema`（含 x-pages / definitions）。
**输出**：`CompiledApp`，运行时零解析开销。

```
BuilderSchema
  → 遍历 x-pages
  → 每个 page.schema：
      ① $ref 展开（委托 core resolveSchemaTree，properties 里的 #/definitions/*）
      ② {{ }} 编译：扫描所有字符串，isExpression 的 → 调 **core.compileExpr** 编成 fn，
         按表达式串缓存（同串复用同一个编译结果）
      ③ router 解析：静态路径段 → 路由表条目
  → CompiledApp { routes: CompiledRoute[], definitions }
```

**表达式编译（核心，本体在 core，engine 只是 AOT 调用方）**：

```ts
// core: compileExpr —— core 与 engine 共用同一原语。
// {{ expr }} → 生成 (scope)=>value；core 运行时惰性调用，engine 构建期提前调用。
function compileExpr(raw: string): (scope: Scope) => unknown {
  const body = extract(raw);                    // 去 {{ }}
  const src = /=>/.test(body) ? body            // 含 => ：本身就是函数
                              : `(${body})`;     // 否则包成值表达式
  // new Function 注入命名空间；schema 框架自建、无用户提交，信任模型成立
  const fn = new Function("$scope", `
    const { $service, $utils, $enums, $query, $values } = $scope;
    return ${src};
  `);
  return (scope) => fn(scope);
}
```

- 隐式 `()=>expr`：值表达式 `{{ $enums.status }}` 编译成返回该值的函数；含 `=>` 的原样成函数工厂。
- **缓存**：按 `raw` 字符串 memo，避免重复 `new Function`。
- **报错定位**：编译失败时把 `raw` + schema 路径包进错误信息。

**编译/运行时解耦**（修正现状的耦合点）：现状 [Runtime.createPage](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/runtime/runtime.ts#L139-L149) 把编译和建实例串在一起，且编译插件反向吃整个 Runtime。新设计中 compiler 只依赖一个**抽象的 resolve 接口**（enums/service 查询），不吃 runtime 实例；`CompiledApp` 是编译→运行时的唯一契约。

---

## 4. 运行时（engine/runtime）：一个 page = 一个 core form

```
路由匹配 CompiledRoute
  → new PageRuntime(compiledPage, appRuntime)
  → 装配 scope（见下）
  → createForm({
       schema:      compiledPage.schema,   // $ref 已展开、{{ }} 已预编译
       definitions: compiledApp.definitions,
       scope:       { $service, $utils, $enums, $query },  // 注入命名空间（无 handlers）
     })
  → form.mount()
```

**作用域装配（scope.ts）**——把命名空间做成 core `FormConfig.scope`，四者**统一为对象**（点访问）：

- `$service.xxx` → 两级 Proxy（service code 是 dotted，如 `records.list` → `$service.records.list`），返回 registry 里 service 的**未调用函数**（lazy）；`$service.records.list(params)` 则内联调用。
- `$utils.xxx` → registry functions（`runtime.fn`）的**未调用函数**；本轮做实注册与调用链路（现为骨架、全仓无调用）。
- `$enums.xxx` → registry constants（改名 enums），扁平单段 key，直接映射为对象属性——点访问最干净。
- `$query.xxx` → 当前路由 URL 查询参数（运行时 atom，URL 变触发更新）。
- `$values` → core 已在 [buildExpressionScope](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L888-L910) 提供，字段间联动桥梁。

> **无 scope（跨组件通信频道）**：本架构不再保留任何 scope/bus 通信频道，一切跨组件联动仅靠 `form + $values` 的 signal 响应式。

**联动数据流**（filter→table，无 scope/无 bus）：

```
filter 组件 onChange → form.set("filter", jsonStr)   // 写 $values.filter（字符串化 JSON）
   ↓ (alien-signals computed)
table 的 props.filter = compiledExpr({{ $values.filter }})(scope) 重算
   ↓
table 组件内部 useEffect 监听 props.filter 变化 → JSON.parse 后调 props.loadData(filter) 请求
```

数据请求留在组件内部（props 注入 service），不进 form.values——符合"真正数据靠组件内部/props"。filter 的 stringify/parse 也归组件自理，协议层不引入 `x-format:"json"` 简写。

---

## 5. React 桥接层（react）：把 form 与运行时都桥进 React

```
<AppProvider runtime={appRuntime}>        // 提供 AppRuntime
  <Router>                                 // 路由（React Router 或 engine RouterAdapter）
    <PageRoute>                            // 匹配 router，取 CompiledPage
      <PageProvider page={pageRuntime}>    // 建 PageRuntime + createForm + mount
        <FormRenderer form={page.form}     // ← 复用现有 form 桥接
          components={registry.ui} />      //   按 component 名解析组件
      </PageProvider>
    </PageRoute>
  </Router>
</AppProvider>
```

- **组件解析**：`component` 字符串 → registry.ui.resolve(name, domain)（domain 优先回退 global，复用现有 [renderer.tsx](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/renderer.tsx) 逻辑）。
- **antd 优先**：`FormRenderer.components` **全量注入 antd 组件**（Input/Select/Table/Button/Flex/Space/Card…）。schema 里的布局与展示直接用 antd 组件名，**不再自研布局组件**；仅当需要"调接口/带业务副作用"（如数据表格加载、提交、删除确认）才写自研业务组件。自研组件同样注册进 registry.ui，与 antd 走同一解析通道。
- **void 字段**：`type:"void"` 字段（table/toolbar/button）不进 form.values，但仍在字段树里、由 FieldSlot 渲染；布局归属由具名插槽控制（**数据上浮、渲染不浮**）。
- **props 里的组件节点**（如 table 的 `delete: {component, props}`）：由宿主组件（table）负责渲染并注入行上下文（`row`），react 桥接层提供 `renderNode(nodeDesc, ctx)` 工具。
- **signal→React**：`useAtom` / `useSignalValue` 用 `useSyncExternalStore` 桥（复用现有 [use-atom.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/use-atom.ts)）。

---

## 6. 迁移步骤（施工顺序）

1. **core：改为消费已编译函数**。删 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts)（parser+astCache 全废）；[executeRuntimeValue](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L836-L877) 收敛为单参 `(scope)=>value`，接收 `CompiledExpr`；删 `@handler` 与 `FormConfig.handlers`；收紧 [buildExpressionScope](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L888-L910) 为显式闭合形状（去掉 `...values`/兄弟 spread）；移除 `dataSourcePolicy`（类型/字段/`applyDataSourcePolicy` 全删，改由组件 props）。core 单测先过（含 scope 形状与已编译 fn 调用；删除 dataSourcePolicy 相关用例）。
2. **engine/protocol**：落地协议类型（XPage/FieldSchema/BuilderSchema）+ golden schema，作为验收基准。
3. **engine/compiler**：实现 `compile`（$ref 展开 + `{{ }}` 编译 + router 解析），产出 `CompiledApp`。补 walking skeleton 单测：能把 golden schema 编译成可执行模型。
4. **engine/runtime**：`AppRuntime` + `PageRuntime`（一 page 一 form）+ scope 装配（四命名空间统一对象/点访问，`$service` 两级 Proxy）。删除 blocks/PageScope/PageBus/ListBlockRuntime。
5. **enums 改名**：`constant`→`enums` 全链路（runtime/registry/marker/注册文件）。
6. **做实 `$utils`**：补 `runtime.fn` 注册与调用（现为骨架、全仓无调用）。
7. **合并 builder 进 engine**：新建 `engine/builder`（`BuilderRuntime`/`History`/`command`，复用 engine `store/` 的 atom），迁入 alien-mdm 的 MDM 核心（`ModelCodec`/`model-page-builder`/`modelCommands`/`types` + 从 field-editor 抽出的 `fieldEditorValuesOf`/`fieldEditorSchemaOf`），MDM 专属默认走注入。**删除整个 `packages/builder`**。
8. **react 重写**：新建 react 桥接层 = 吸收现有 form 桥接（`FormRenderer.components` 全量注入 antd）+ 搬入 engine/react 运行时桥接 + 搬入 builder 的 React 绑定；断开 engine→react 依赖（删 engine `src/react/`、`./react` 入口、`@alien-form/react` 依赖）。
9. **alien-mdm app 重写**：`src/compiler`（现已空）与 `src/runtime` 重写为薄 app 装配（engine Runtime 实例化 + registry 访问 + transport + DTO）；`src/domains/model` **只留 UI**（pages/components/hooks），核心逻辑已迁 engine。import 从 `@alien-form/builder`(+`/react`) 收敛到 `@alien-form/engine` + `@alien-form/react`。
10. **walking skeleton 端到端**：只做 `_sys_models/list`，跑通 schema→编译→form→渲染→filter/table 联动。
11. **铺开**：add/edit 页、其余模型；全仓 import 通道收敛到单一 `@alien-form/react`。

---

## 7. 风险与注意

- **`new Function` 的信任边界**：仅因 schema 框架自建、构建模型功能使用者不可用才成立。若未来开放使用者写 schema，需重新评估。
- **`$service` 两级 Proxy vs dotted code**：service code 是 dotted（`records.list`），点访问需两级 Proxy 或保留单键 `$service["records.list"]`；`$enums`/constants 是扁平单段 key，点访问天然干净。求值器必须**放开成员访问 + 函数调用**（现 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts) 禁止一切函数调用，是 golden schema 跑不了的真正阻塞点）。
- **void 字段：数据上浮 vs 渲染归属**：core void 语义是"子字段数据扁平上浮"，实现时必须保证 toolbar/delete 只是数据不占路径，渲染仍在宿主组件内，别浮到页面顶层。
- **编译期 resolve 抽象**：compiler 不应吃整个 runtime（现状 [TranslateCtx.runtime](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/compiler/types.ts) 的耦合），只依赖一个 enums/service 查询接口，保持编译/运行时可分离。
- **builder MDM 默认约定的归属**：`ModelCodec.defaultFields`/`DEFAULT_LAYOUT` 里的审计列、`records.*`/`schema.*` service code、`main`/`form`/`filter` 块名、`record-page`/`overlay` 布局名是 MDM app 策略，迁入 engine 时必须**注入化**而非硬编码，保持 engine 通用。
- **`packages/builder` 的引用面**：仅 `Registry` 类型 + `./react` 绑定 + `BuilderRuntime` 值。删包后确保这些从 `@alien-form/engine` / `@alien-form/react` 主入口仍可得，`packages/builder/src/core/runtime.ts` 的私有 `SignalAtom` 换成 engine `store/` 的 atom。

---

## 附：现状 vs 目标依赖方向

```
现状（错）：           目标：
core ← react          core ← engine ← react
core ← engine → react
（engine 反向依赖 react）
```
