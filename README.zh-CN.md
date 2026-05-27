<p align="center">
  <img src="https://img.shields.io/badge/alien--signals-powered-7C3AED?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjQiLz48cGF0aCBkPSJNMTIgMnYyTTEyIDIwdjJNMiAxMmgyTTIwIDEyaDJNNC45MyA0LjkzbDEuNDEgMS40MU0xNy42NiAxNy42NmwxLjQxIDEuNDFNNC45MyAxOS4wN2wxLjQxLTEuNDFNMTcuNjYgNi4zNGwxLjQxLTEuNDEiLz48L3N2Zz4=&logoColor=white" alt="alien-signals powered">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/zero_dependencies-18181B?style=for-the-badge" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/~3KB_gzipped-059669?style=for-the-badge" alt="Bundle Size">
  <img src="https://img.shields.io/badge/license-MIT-18181B?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">@alien-form/core</h1>

<p align="center">
  <b>无头、信号驱动的表单引擎，内置沙箱表达式运行时与声明式 Schema 协议。</b>
</p>

<p align="center">
  <a href="#安装">安装</a> &#8226;
  <a href="#快速开始">快速开始</a> &#8226;
  <a href="#架构">架构</a> &#8226;
  <a href="#api-参考">API</a> &#8226;
  <a href="#schema-协议">Schema 协议</a> &#8226;
  <a href="#what-is-this">English</a>
</p>

---

## 这是什么？

`@alien-form/core` 是一个**框架无关的表单状态机**，构建于 [`alien-signals`](https://github.com/nicepkg/alien-signals) 之上 — 目前 JavaScript 生态中最快的细粒度响应式原语之一。

它提供：

- **响应式字段图** — 每个字段属性（value、display、pattern、errors、loading...）都是一个 signal，依赖自动追踪。
- **声明式 Schema 协议** — 以纯 JSON 描述表单结构、校验、条件逻辑与值转换，无需命令式样板代码。
- **沙箱表达式运行时** — 手写的递归下降解析器，执行安全的 JavaScript 子集（无 `eval`，无 `new Function`，无原型链访问），结构性安全。
- **一等公民的数组字段** — push/remove/move/swap 行操作，自动管理子字段树与路径重编号。
- **循环检测** — 静态（schema 加载时的图分析）+ 运行时（重入检测与频率守卫），错误配置的联动会被捕获而不会无限循环。
- **异步感知的 reactions** — 版本戳记的 computed handlers，自动丢弃过期结果，自动管理 loading 状态。

整个引擎 gzip 后约 3KB，仅依赖 `alien-signals`。不绑定 React，不操作 DOM，不对 UI 做任何假设。

---

## 生态定位

| 层级 | 角色 | 示例 |
|------|------|------|
| **Schema DSL** | 结构与规则声明 | JSON / TypeScript 字面量 |
| **@alien-form/core** | **状态机 + 协议执行** | 本包 |
| **绑定层** | 框架胶水 | `@alien-form/react`、Vue adapter、Svelte adapter |
| **UI 组件** | 视觉渲染 | `@alien-form/ui`、Ant Design、你的设计系统 |
| **业务逻辑** | 副作用、API 调用 | `setup + effect`、computed handlers |

与 Formily、React Hook Form 或 Final Form 不同 — 这个引擎**不知道 DOM 是什么**。它是纯粹的状态编排器。你的 React/Vue/Svelte 绑定层消费 signal 图，你的 UI 组件订阅字段实例。边界是绝对的。

### 与主流方案对比

| | @alien-form/core | Formily Core | React Hook Form | Final Form |
|---|---|---|---|---|
| 响应式 | alien-signals（细粒度） | @formily/reactive（MobX 式） | 基于重渲染 | 订阅模型 |
| 框架耦合 | 无 | 无（但 React 偏重） | 仅 React | 无 |
| 表达式安全 | 沙箱解析器，无 eval | `new Function()` | 不适用 | 不适用 |
| Schema 协议 | 4 种规则类型，收敛设计 | 广泛且持续膨胀 | 不适用 | 不适用 |
| 包体积 | ~3KB | ~45KB | ~9KB | ~5KB |
| 数组支持 | 内置控制器 | 内置 | 插件 | 手动 |
| 循环检测 | 静态 + 运行时 | 仅运行时 | 不适用 | 不适用 |

---

## 安装

```bash
npm install @alien-form/core
# 或
pnpm add @alien-form/core
# 或
yarn add @alien-form/core
```

**对等依赖：** `alien-signals@^3.2.1`（自动安装）。

---

## 快速开始

```typescript
import { createForm } from "@alien-form/core";
import type { IFormSchema } from "@alien-form/core";

// 1. 定义 schema
const schema: IFormSchema = {
  type: "object",
  required: ["email"],
  properties: {
    email: {
      type: "string",
      title: "邮箱",
      format: "email",
      component: "Input",
    },
    role: {
      type: "string",
      title: "角色",
      component: "Select",
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
      ],
    },
    permissions: {
      type: "string",
      title: "权限",
      component: "Select",
      "x-reaction": {
        dataSource: {
          type: "match",
          dependencies: { role: "role" },
          source: "$dependencies.role",
          match: {
            admin: [
              { label: "全部", value: "*" },
              { label: "只读", value: "read" },
            ],
            user: [{ label: "只读", value: "read" }],
            default: [],
          },
        },
        visible: {
          type: "expression",
          dependencies: ["role"],
          expression: "$deps[0] !== undefined && $deps[0] !== ''",
        },
      },
    },
  },
};

// 2. 创建表单实例
const form = createForm({
  initialValues: { email: "", role: "user" },
  setup(instance) {
    return instance.effect(
      (f) => f.getField("role")?.value,
      (role, prevRole) => {
        console.log(`角色变更：${prevRole} -> ${role}`);
      },
    );
  },
});

// 3. 加载 schema — 字段创建、联动生效
form.setSchema(schema);

// 4. 交互
form.setValues({ email: "hello@example.com", role: "admin" });
console.log(form.getField("permissions")?.dataSource);
// => [{ label: "全部", value: "*" }, { label: "只读", value: "read" }]

// 5. 校验
const valid = await form.validate();
console.log(valid, form.errors);
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        createForm(config)                            │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│  IForm   │  fields: Map<path, IField>                               │
│          │  values: computed（output 格式化、仅可见字段）              │
│          │  effect(): alien-signals 响应式 effect                    │
│          │  subscribe(): 任意字段变更通知                              │
│          │  setSchema(): 完整 schema 加载 + 联动接线                  │
│          │                                                          │
├──────────┼──────────────────────────────────────────────────────────┤
│          │                                                          │
│  IField  │  signals: value, display, pattern, required, errors...   │
│          │  meta: title, component, decorator, props（冷信号）       │
│          │  arrayController: push/remove/move/swap                   │
│          │  validate(): 同步规则 + 异步 x-validate                   │
│          │                                                          │
├──────────┼──────────────────────────────────────────────────────────┤
│          │                                                          │
│ Runtime  │  x-reaction: 字段属性派生（基于 effect）                   │
│          │  x-format: 同步输入/输出值转换                             │
│          │  x-validate: 动态校验规则派生                              │
│          │  expression: 沙箱解析器（无 eval/Function）                │
│          │  循环检测: 静态图分析 + 运行时守卫                          │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### 每个字段的 Signal 布局

每个字段底层有 **12 个 signals + 1 个 meta 对象**（而非 20+ 个独立 signal）。`meta` signal 将不常变化的属性（title、description、component、decorator、props）打包为单个冻结对象 — 一起读取、一起更新。高频路径（value、display、pattern、errors）拥有独立 signal，最小化重计算。

---

## API 参考

### `createForm(config?: FormConfig): IForm`

创建无头表单实例。

```typescript
interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  setup?: (form: IForm) => void | (() => void);
  scope?: Record<string, any>;          // 注入表达式运行时
  handlers?: Record<string, RuntimeRuleHandler>;  // computed 规则处理器
  onError?: (error: FormError) => void;  // 非致命运行时错误
}
```

### IForm

| 属性 / 方法 | 说明 |
|---|---|
| `fields` | `Map<string, IField>` — 所有已注册字段 |
| `values` | 计算聚合（output 格式化、仅可见字段） |
| `valid` / `invalid` | 由字段 errors 派生 |
| `errors` | 所有可见字段 errors 的扁平数组 |
| `submitting` | 布尔信号，`submit()` 期间自动管理 |
| `createField(path, schema, initialValue?)` | 手动注册字段 |
| `getField(path)` | 按点路径查找 |
| `setFieldState(path, setter)` | 批量更新字段状态 |
| `setValues(values)` | 批量设值（带 input 格式化） |
| `setInitialValues(values)` | 更新初始值引用 |
| `reset()` | 重置所有字段至初始值 |
| `validate()` | 校验所有可见字段，返回 `Promise<boolean>` |
| `submit(onSubmit?)` | 校验 + 调用提交处理器 |
| `setSchema(schema)` | 加载/替换完整 schema，重新接线所有联动 |
| `effect(runner)` | 响应式 effect（alien-signals） |
| `effect(selector, listener, options?)` | watch + callback 模式 |
| `destroy()` | 清理所有 effects 和 reactions |
| `onError(listener)` | 订阅非致命运行时错误 |

### IField

| 属性 | 类型 | 说明 |
|---|---|---|
| `path` | `string` | 点分隔字段路径 |
| `value` | `any` | 当前值（数组字段返回收集后的数组） |
| `display` | `"visible" \| "hidden" \| "none"` | 可见性状态 |
| `pattern` | `"editable" \| "readOnly" \| "disabled" \| "readPretty"` | 交互模式 |
| `required` | `boolean` | 必填标记 |
| `errors` / `warnings` | `FieldError[]` | 校验结果 |
| `validateStatus` | `"" \| "success" \| "error" \| "warning" \| "validating"` | 当前状态 |
| `loading` | `boolean` | 异步操作进行中 |
| `dataSource` | `Array<{ label, value }>` | 选项数据 |
| `isArrayField` | `boolean` | 是否为数组容器 |
| `arrayItems` | `IField[][]` | 按行分组的子字段 |

| 方法 | 说明 |
|---|---|
| `setValue(value)` | 更新值 |
| `setState(partial)` | 批量更新多个属性 |
| `validate()` | 运行校验器，返回 `Promise<FieldError[]>` |
| `reset()` | 重置至初始值 |
| `push(initialValues?)` | 数组：追加行 |
| `remove(index)` | 数组：删除行 + 重编号 |
| `moveUp(index)` / `moveDown(index)` | 数组：交换相邻行 |
| `subscribe(listener)` | 响应字段任意变更 |
| `effect(runner)` | 作用域限定于此字段的响应式 effect |

---

## Schema 协议

Schema 协议刻意只使用 **4 种规则类型**，保持声明面小且可审计：

### 规则类型

| 类型 | 用途 | 示例 |
|---|---|---|
| `static` | 常量值 | `{ type: "static", value: true }` |
| `expression` | 沙箱 JS 表达式 | `{ type: "expression", expression: "$deps[0] > 18" }` |
| `match` | 模式匹配（类 switch-case） | `{ type: "match", source: "$deps.role", match: { admin: true, default: false } }` |
| `computed` | 命名处理函数（支持异步） | `{ type: "computed", handler: "fetchOptions", params: { api: "/roles" } }` |

### Schema 扩展

| 扩展 | 用途 | 同步/异步 |
|---|---|---|
| `x-reaction` | 从依赖派生字段属性 | 两者皆可（computed 处理器可异步） |
| `x-format` | 输入/输出值转换 | 仅同步 |
| `x-validate` | 动态校验逻辑 | 两者皆可 |

### 表达式作用域

表达式可访问以下变量：

| 变量 | 说明 |
|---|---|
| `$self` | 当前字段实例 |
| `$form` | 表单实例 |
| `$values` | 当前表单值快照 |
| `$deps` | 已解析的依赖（数组或对象） |
| `$dependencies` | 已解析的依赖（命名对象） |
| `$value` | 当前字段值（或 x-format 管道中的值） |
| `...scope` | `FormConfig.scope` 中的自定义变量 |

### 表达式安全性

表达式运行时是一个**手写的递归下降解析器**，拒绝：

- 函数调用（`fn()`）
- 模板字符串（`` ` ``）
- 赋值（`=`、`+=` 等）
- 箭头函数（`=>`）
- `globalThis`、`window`、`document`、`process`、`eval`、`constructor`、`prototype`、`__proto__`

这**不是**带黑名单的 `eval`。它是白名单解析器，只识别：字面量、标识符、成员访问、算术、比较、逻辑运算符、三元表达式、数组/对象字面量。

---

## 数组字段

数组字段是一等公民，拥有专用的 `ArrayFieldController`：

```typescript
const schema: IFormSchema = {
  type: "object",
  properties: {
    contacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", title: "姓名" },
          phone: { type: "string", title: "电话", format: "phone" },
        },
      },
    },
  },
};

const form = createForm({
  initialValues: { contacts: [{ name: "Alice", phone: "123" }] },
});
form.setSchema(schema);

const contacts = form.getField("contacts")!;
contacts.push({ name: "Bob", phone: "456" });       // 追加行
contacts.remove(0);                                   // 删除 + 重编号
contacts.moveDown(0);                                 // 交换行
console.log(contacts.value);                          // 收集后的数组
console.log(contacts.arrayItems);                     // [[IField, IField], ...]
```

行操作自动：
- 创建/销毁子字段树
- 重命名路径（重编号）所有后代
- 通知表单级 computed 值的结构变更
- 批量更新信号以避免中间态渲染

---

## Effects 与副作用

```typescript
const form = createForm({
  setup(instance) {
    // 模式 1：响应式 runner（追踪的信号变化时重新执行）
    const stop1 = instance.effect((f, ctx) => {
      const role = f.getField("role")?.value;
      if (role === "banned") ctx.stop(); // 自清理
    });

    // 模式 2：selector + listener（仅选定值变化时触发）
    const stop2 = instance.effect(
      (f) => f.getField("country")?.value,
      (country, prevCountry) => {
        // 为新国家获取城市列表...
      },
      { immediate: true },
    );

    // 返回清理函数
    return () => { stop1(); stop2(); };
  },
});
```

Effects 由表单追踪，`form.destroy()` 时自动销毁。

---

## 错误处理

非致命错误（表达式错误、未解析的 `$ref`、循环检测、异步联动失败）通过错误通道上报：

```typescript
const form = createForm({
  onError(error) {
    // error.scope: "reaction" | "x-reaction" | "x-format" | "x-validate" | "ref-resolve" | "expression"
    // error.path: 字段路径或 ""
    // error.key: reaction key 或规则种类
    // error.message: 人可读信息
    // error.cause: 原始错误对象
    analytics.track("form_runtime_error", error);
  },
});
```

若未注册 `onError` 监听器，错误将通过 `console.warn` 打印。

---

## 设计决策

1. **4 种规则类型，不多不少。** `static`、`expression`、`match`、`computed` 覆盖所有声明式需求。新增规则类型是协议扩展 — 应当稀少且慎重。

2. **x-format 是同步的。** 值转换在 `setValue`/`setValues` 内联发生。异步转换属于 `x-reaction` 的 computed 处理器，由外部更新字段。

3. **没有事件总线。** 没有 `onFieldChange("path", callback)`。Effects 自动追踪响应式依赖。这消灭了「哪个处理器先触发」这类 bug。

4. **Reactions 只派生字段自身属性。** 字段 A 的 reaction 不能直接修改字段 B。跨字段编排属于 `setup + effect`。这使 schema 可审计 — 每个字段的行为是自包含的。

5. **表达式运行时是解析器，不是沙箱。** 无 `Function()`，无 `with()`，无 `Proxy` 包装。AST 同步遍历。攻击面仅限解析器本身（~380 行），可轻松审计。

6. **字段信号经过内存优化。** 高频信号（value、display、pattern）独立。低频元数据（title、component、decorator、props）打包为单个信号对象。与朴素的每属性一个 signal 相比减少约 40% 的逐字段开销。

---

## 前景分析

`@alien-form/core` 定位于表单引擎赛道的「内核层」，面向的是需要长期维护复杂表单的企业场景。其发展前景取决于几个结构性优势：

1. **alien-signals 生态的上升期。** 随着 signals 成为 TC39 提案并被各框架采纳，基于 alien-signals 的形态将获得天然的框架互操作性。
2. **安全表达式的合规需求。** 在金融、医疗、政企等场景中，`new Function()` 式的表达式执行越来越难通过安全审计。白名单解析器是这些场景的刚需。
3. **Schema 协议收敛的治理价值。** 4 种规则类型的约束不是能力弱，而是让 schema 可审计、可静态分析、可工具化（lint、类型推断、可视化编辑器）。
4. **headless 架构的复用潜力。** 同一个 core 可以驱动 React、Vue、Svelte、甚至 native 端（通过绑定层适配），投入产出比远高于耦合框架的方案。

---

## 开发

```bash
pnpm install
pnpm test:core     # 运行 core 测试（vitest）
pnpm build         # tsup → ESM + CJS + DTS
```

### 源码导航

```
src/
├── index.ts                      # 公开 API 面
├── schema/
│   ├── types.ts                  # 所有类型定义
│   ├── expression.ts             # 沙箱表达式解析器 + 求值器
│   ├── validation.ts             # 纯校验规则逻辑
│   ├── normalize.ts              # Schema 规范化辅助
│   └── path.ts                   # 路径工具（深度 get/set、排序、void 检测）
├── engine/
│   ├── form/
│   │   ├── create-form.ts        # 工厂入口
│   │   ├── methods.ts            # 所有表单方法 + 值收集
│   │   └── internals.ts          # 内部状态（signals、Maps、Sets）
│   ├── field/
│   │   ├── create-field.ts       # 字段工厂
│   │   ├── methods.ts            # 字段方法集
│   │   ├── internals.ts          # 字段 signal 布局
│   │   ├── array-controller.ts   # 数组行 CRUD + 重编号
│   │   └── validation.ts         # 异步校验器运行器
│   └── runtime/
│       ├── reaction.ts           # 规则解析、作用域构建、应用
│       └── rule-effect.ts        # Effect 安装、循环检测、同步
└── utils.ts                      # arrayShallowEqual、isPromiseLike、readUntracked
```

---

## License

MIT
