# Alien-Form 系统重构分析：core ← engine ← react

> 从零构建的目标架构分析。基于对现有 `packages/core`、`packages/engine`、`packages/react` 的实际代码调研，以及本轮已锁定的页面协议。

---

## 0. 结论速览

| 维度 | 决策 |
|---|---|
| 依赖方向 | `core ← engine ← react`（当前 engine→react 是**反的**，本次倒转） |
| core | **保留不动**（纯逻辑，仅依赖 alien-signals，零 React/DOM） |
| engine | 纯逻辑框架大脑 = `engine/compiler`（构建时）+ `engine/runtime`（运行时）；**删除 blocks/PageScope/PageBus/ListBlockRuntime** |
| react | **删除重写**：吸收现有 form 桥接 + 从 engine 搬入的运行时桥接，成为唯一 React 层 |
| page 模型 | **一个 page = 一个 core form**（纯 form 模型） |
| compiler 产物 | **预编译成"可执行页面模型"**（表达式已编译成函数、$ref 已展开） |
| 表达式 | `{{ }}` 统一改 `new Function`；删除 core 自研求值器 |
| $ref | 纯引用语义（不覆盖，有差异另建 definition），复用块放 `properties`，前缀 `#/definitions/` |

---

## 1. 三层职责与依赖契约

### 1.1 `@alien-form/core`（保留）

纯逻辑内核，已验证零 React/DOM 依赖，唯一依赖 alien-signals。engine 依赖它的契约面：

- `createForm(FormConfig): FormInstance` —— 每个 page 就是一个 form。
- `FormConfig.{schema, definitions, scope, handlers, initialValues, onError}` —— `scope`/`handlers` 是注入 `$service/$utils/$enums/$query` 的天然入口。
- `resolveSchemaTree(schema, definitions)` —— $ref 展开 + 循环检测（前缀 `#/definitions/`，仅递归 `properties`/`items`）。
- `FormInstance.{values, fields, field, get, set, mount, unmount, scope, effect}` —— 基于 alien-signals 的响应式。
- 转发的 signal 原语（`signal/computed/effect`），供 react 桥接层用，无需直接依赖 alien-signals。

**唯一改动**：删除 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts) 自研求值器，`executeRuntimeValue`/`buildExpressionScope`（[form.ts:836-910](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L836-L910)）改调 engine 提供的统一 `new Function` 求值器。原因：现有求值器**从设计上禁止函数调用**（[expression.ts:67](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts#L67)），而新协议全是 `{{ (p)=>$service('x')(p) }}` 这类函数工厂，跑不了。

> 注：求值器可以放在 core（保持 core 自洽）或 engine。建议放 **core**——因为字段规则求值发生在 core 内部，engine 只是复用同一个求值器。engine 不需要为此反向依赖任何东西。

### 1.2 `@alien-form/engine`（重写为纯逻辑）

框架大脑，**无 React**（保留现有 [check-boundaries.mjs](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/scripts/check-boundaries.mjs) 的约束并加强到全包）。两个明确子域：

```
packages/engine/src/
├── compiler/              # 构建时：schema → 可执行页面模型
│   ├── compile.ts         #   编译主流程
│   ├── expression.ts      #   {{ }} → new Function 编译（编译期一次性，带缓存）
│   ├── ref.ts             #   $ref 展开（委托 core resolveSchemaTree）
│   ├── router.ts          #   x-pages / router 静态路径解析
│   └── types.ts           #   CompiledApp / CompiledPage 契约
├── runtime/               # 运行时：页面实例
│   ├── app-runtime.ts     #   AppRuntime（注册中心 + 编译入口 + 路由）
│   ├── page-runtime.ts    #   PageRuntime（= 装配一个 core form）
│   ├── scope.ts           #   作用域装配：$service/$utils/$enums/$query/$values
│   └── router.ts          #   运行时路由匹配（静态段）
├── registry/              # 组件/service/utils/enums 注册表（保留现有 namespace 两级）
└── protocol/              # 协议类型（XPage/FieldSchema/BuilderSchema）+ golden schema
```

**删除**（纯 form 模型下变冗余）：`page/blocks/*`（list/form/detail/custom）、`BlockSchema`、`PageScope`（旧的能力门面）、`PageBus`、`SharedShelf`、`ListBlockRuntime`。它们的职责被"一个 form + `$values` 联动 + 组件内部自取数据"接管。

**保留复用**：`registry/`（两级 namespace）、`router/`（RouterAdapter 接口 + MemoryRouterAdapter）、`store/`（如运行时仍需页面级 atom）、`compiler/walker.ts`（路径读写工具）。

### 1.3 `@alien-form/react`（删除重写）

唯一 React 桥接层，依赖 engine。由两部分合并而成：

1. **form 桥接**（吸收现有 [packages/react/src/index.tsx](file:///Users/bytedance/Documents/cowork/alien-form/packages/react/src/index.tsx)）：`FormRenderer` / `SchemaField` / FieldSlot 家族 / `useField*` / `useForm` / `useCreateForm` / `FormContext`。这套是成熟实现，**吸收而非重写**。
2. **运行时桥接**（从 engine 的 [src/react/*](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/renderer.tsx) 搬入并重写）：`PageProvider` / `usePage` / `useRouter` / 页面渲染入口 / `useAtom`（signal→React 的 `useSyncExternalStore` 桥）。

`packages/react/package.json` 新增 `@alien-form/engine` 依赖。engine 侧删除 `src/react/`、删除 `./react` 子入口、`package.json` 移除 `@alien-form/react`——**反向依赖就此断开**。

---

## 2. 页面协议（本轮定稿）

一切皆 alien-form 字段，`type` 决定数据行为：

| 维度 | 规则 |
|---|---|
| 页面单元 | `x-page = { router, layout?, schema }`，`schema` 就是一份 alien-form |
| 数据行为 | 非 void = 收值输入源（onChange 写 `$values`）；`type:"void"` = 布局/展示/操作容器，不占 `form.values` |
| 组件联动 | 输入源写 `$values.x` → 消费方 `{{ $values.x }}` 读，纯 signal 响应式 |
| 布局 | 具名插槽（`layout.props` / 容器 props），值为同级 `properties` 字段名；省略 layout 默认 pageCard |
| 业务数据 | props 里 `{{ $service }}` / `{{ $utils.xxx }}`，返回**未调用**的函数，组件内部自行调用 |
| filter 值 | 字符串化 JSON，`x-format:"json"` 自动 stringify/parse |
| 表达式 | `{{ }}` 唯一，`new Function`，隐式 `()=>expr`，含 `=>` 即函数工厂 |
| 静态引用 | `$ref` 唯一，纯引用（不覆盖），前缀 `#/definitions/`，复用块放 `properties` |
| 命名空间 | `$service` / `$utils` / `$enums`（原 constant 改名）/ `$query` / `$values` |
| 已删除 | scope、发布订阅、x-model、$props、blocks |

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
      ② {{ }} 编译：扫描所有字符串，isExpression 的 → new Function 编译成 fn，
         按表达式串缓存（同串复用同一个编译结果）
      ③ router 解析：静态路径段 → 路由表条目
  → CompiledApp { routes: CompiledRoute[], definitions }
```

**表达式编译（核心）**：

```ts
// {{ expr }} → 编译期一次性生成函数
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
       schema:      compiledPage.schema,   // $ref 已展开
       definitions: compiledApp.definitions,
       scope:       { $service, $utils, $enums, $query },  // 注入命名空间
       handlers,
     })
  → form.mount()
```

**作用域装配（scope.ts）**——把命名空间做成 core `FormConfig.scope`：

- `$service(code)` → 返回 registry 里 service 的**未调用函数**（lazy）。
- `$utils.xxx` → registry functions 的**未调用函数**（做实现有 `runtime.fn` 骨架）。
- `$enums.xxx` → registry constants（改名 enums）。
- `$query.xxx` → 当前路由 URL 查询参数（运行时 atom，URL 变触发更新）。
- `$values` → core 已在 [buildExpressionScope](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts#L888-L910) 提供，字段间联动桥梁。

**联动数据流**（filter→table，无 scope/无 bus）：

```
filter 组件 onChange → form.set("filter", json)   // 写 $values.filter
   ↓ (alien-signals computed)
table 的 props.filter = compiledExpr({{ $values.filter }})(scope) 重算
   ↓
table 组件内部 useEffect 监听 props.filter 变化 → 调 props.loadData(filter) 请求
```

数据请求留在组件内部（props 注入 service），不进 form.values——符合"真正数据靠组件内部/props"。

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
- **void 字段**：`type:"void"` 字段（table/toolbar/button）不进 form.values，但仍在字段树里、由 FieldSlot 渲染；布局归属由具名插槽控制（**数据上浮、渲染不浮**）。
- **props 里的组件节点**（如 table 的 `delete: {component, props}`）：由宿主组件（table）负责渲染并注入行上下文（`row`），react 桥接层提供 `renderNode(nodeDesc, ctx)` 工具。
- **signal→React**：`useAtom` / `useSignalValue` 用 `useSyncExternalStore` 桥（复用现有 [use-atom.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/react/use-atom.ts)）。

---

## 6. 迁移步骤（施工顺序）

1. **core：换表达式引擎**。写 `new Function` 求值器（放 core），删 [expression.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/expression.ts)，改 [form.ts](file:///Users/bytedance/Documents/cowork/alien-form/packages/core/src/form.ts) 的 `executeRuntimeValue` 调新引擎。core 单测先过。
2. **engine/protocol**：落地协议类型（XPage/FieldSchema/BuilderSchema）+ golden schema，作为验收基准。
3. **engine/compiler**：实现 `compile`（$ref 展开 + `{{ }}` 编译 + router 解析），产出 `CompiledApp`。补 walking skeleton 单测：能把 golden schema 编译成可执行模型。
4. **engine/runtime**：`AppRuntime` + `PageRuntime`（一 page 一 form）+ scope 装配。删除 blocks/PageScope/PageBus/ListBlockRuntime。
5. **enums 改名**：`constant`→`enums` 全链路（runtime/registry/marker/注册文件）。
6. **做实 `$utils`**：补 `runtime.fn` 注册与调用。
7. **react 重写**：新建 react 桥接层 = 吸收现有 form 桥接 + 搬入 engine/react 运行时桥接；断开 engine→react 依赖（删 engine `src/react/`、`./react` 入口、`@alien-form/react` 依赖）。
8. **walking skeleton 端到端**：只做 `_sys_models/list`，跑通 schema→编译→form→渲染→filter/table 联动。
9. **铺开**：add/edit 页、其余模型；alien-mdm 的 import 从双通道（`@alien-form/engine/react` + `@alien-form/react`）收敛到单一 `@alien-form/react`；同步 `packages/builder` 对 engine 的类型引用。

---

## 7. 风险与注意

- **`new Function` 的信任边界**：仅因 schema 框架自建、构建模型功能使用者不可用才成立。若未来开放使用者写 schema，需重新评估。
- **void 字段：数据上浮 vs 渲染归属**：core void 语义是"子字段数据扁平上浮"，实现时必须保证 toolbar/delete 只是数据不占路径，渲染仍在宿主组件内，别浮到页面顶层。
- **编译期 resolve 抽象**：compiler 不应吃整个 runtime（现状 [TranslateCtx.runtime](file:///Users/bytedance/Documents/cowork/alien-form/packages/engine/src/core/compiler/types.ts) 的耦合），只依赖一个 enums/service 查询接口，保持编译/运行时可分离。
- **builder 包**：`packages/builder` 依赖 engine 的 `Registry` 类型，出口调整后需保证类型仍从 engine 主入口可得。
- **scope（跨组件通信频道）仍待定**：本架构用"一 form + $values 联动"覆盖了绝大多数联动；若后续确有非 form 的跨页通信需求，再基于保留与否的 PageBus 增量设计。

---

## 附：现状 vs 目标依赖方向

```
现状（错）：           目标：
core ← react          core ← engine ← react
core ← engine → react
（engine 反向依赖 react）
```
