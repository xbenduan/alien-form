# @alien-form/core

基于 [alien-signals](https://github.com/stackblitz/alien-signals) 的**框架无关**表单引擎。它用一份 JSON Schema 描述表单结构，构建出一棵响应式的**字段树**，并提供取值、联动、校验、提交等全部能力。它不依赖任何 UI 框架，React 绑定请见 `@alien-form/react`。

> 想直接在 React 里用，只装 `@alien-form/react` 即可，它已经把 core 全量再导出。本文档面向核心引擎本身、以及需要在非 React 环境使用的场景。

---

## 目录

- [安装](#安装)
- [30 秒上手](#30-秒上手)
- [核心心智模型](#核心心智模型)
- [Schema：如何描述一个表单](#schema如何描述一个表单)
  - [字段类型与四种节点](#字段类型与四种节点)
  - [void 布局节点（x-layout）](#void-布局节点x-layout)
  - [`$ref` 与 `definitions` 复用](#ref-与-definitions-复用)
  - [字段排序 order](#字段排序-order)
- [`createForm(config)`](#createformconfig)
- [FormInstance：表单实例 API](#forminstance表单实例-api)
- [FieldNode：字段节点 API](#fieldnode字段节点-api)
- [Selector：选择器语法](#selector选择器语法)
- [响应式规则（x-reaction / x-effect / x-format / x-validate）](#响应式规则)
  - [规则值的三种写法](#规则值的三种写法)
  - [x-reaction 字段联动](#x-reaction-字段联动)
  - [x-effect 副作用](#x-effect-副作用)
  - [x-format 输入/输出格式化](#x-format-输入输出格式化)
  - [x-validate 自定义校验](#x-validate-自定义校验)
  - [ExpressionScope：规则运行时作用域](#expressionscope规则运行时作用域)
- [表达式语言 `{{ }}`](#表达式语言--)
- [数据源](#数据源)
- [校验与提交](#校验与提交)
- [错误处理 onError](#错误处理-onerror)
- [工具函数导出](#工具函数导出)
- [完整类型速查表](#完整类型速查表)

---

## 安装

```bash
pnpm add @alien-form/core
# 或 npm install @alien-form/core / yarn add @alien-form/core
```

`alien-signals` 是它的运行时依赖，会随包自动安装。core 把常用的 signal 原语（`signal` / `computed` / `effect` / `startBatch` / `endBatch`）再导出，下游无需单独依赖 alien-signals。

---

## 30 秒上手

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  schema: {
    type: "object",
    properties: {
      name: { type: "string", required: true, title: "姓名" },
      age: { type: "number", default: 18 },
    },
  },
  initialValues: { name: "Alien" },
});

// 读值
form.get("name"); // "Alien"
form.values(); // { name: "Alien", age: 18 }

// 写值
form.set("age", 20);
form.get("age"); // 20

// 校验 + 提交
await form.submit(); // 校验通过则 resolve 出最终值对象
```

---

## 核心心智模型

理解下面 4 点，整个库就通了：

1. **一份 Schema → 一棵字段树。** `createForm` 读取 schema，把每个字段构建成一个 **FieldNode**（字段节点）。所有节点还被拍平存进一张 `path -> FieldNode` 的表里，用**点路径**（如 `user.address.city`、`items.0.name`）定位。

2. **只有基本类型（string / number / boolean）持有响应式值。** 叶子字段（primitive）通过 `signal` 保存自己的值；object / array 本身不存值，它们的值由子节点**投影（project）**聚合而来。这意味着：_不要往叶子字段塞对象或数组_——复杂结构请用 `properties` / `items` 拆分，简单的多值（如多选、标签）请在组件里序列化成字符串。

3. **字段的每一项能力都是一个 signal。** `display` / `disabled` / `required` / `errors` / `title` / `component` / `dataSource` … 全是独立的响应式源。改任意一项，只有订阅它的地方会更新。这就是「value-capability runtime（值-能力运行时）」的含义。

4. **联动规则是声明在 schema 里的、跑在 signal effect 中的函数。** `x-reaction` / `x-effect` 等在 `form.mount()` 后启动；它们读到哪些 signal，就自动依赖哪些 signal，源变化时自动重算。

---

## Schema：如何描述一个表单

顶层用 `IFormSchema`，字段用 `IFieldSchema`。

```ts
interface IFormSchema {
  type: "object";
  title?: string;
  description?: string;
  required?: boolean | string[];
  "x-layout"?: string;                       // 整个表单套一个布局组件
  properties?: Record<string, IFieldSchema>; // 顶层字段
  definitions?: Record<string, IFieldSchema>; // 供 $ref 复用的定义
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
}

interface IFieldSchema {
  type?: "string" | "number" | "boolean" | "object" | "array" | string;
  title?: string;
  description?: string;
  default?: any;
  properties?: Record<string, IFieldSchema>; // object 的子字段
  items?: IFieldSchema | IFieldSchema[];      // array 的行结构
  $ref?: string;                               // 引用 definitions
  order?: number;                              // 同级排序
  required?: boolean | string[];
  display?: "visible" | "hidden" | "none";
  disabled?: boolean;

  // 展示层
  "x-layout"?: string;             // 声明为布局(void)节点，值即默认组件名
  component?: string;              // 渲染组件名（交给 UI 层解析）
  props?: Record<string, any>;     // 传给组件的初始 props
  decorator?: string;              // 装饰器组件名，默认 "FormItem"
  decoratorProps?: Record<string, any>;

  // 数据源
  dataSource?: SchemaRuntimeValue; // 静态或响应式选项

  // 响应式规则
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
  "x-format"?: { input?: ...; output?: ... };
  "x-validate"?: SchemaXValidate;
}
```

`required` 有两种写法：字段自己写 `required: true`；或者父级 object 用 JSON-Schema 风格的字符串数组 `required: ["name", "email"]` 声明哪些子字段必填。

### 字段类型与四种节点

`type` 决定字段被构建成哪一种 **FieldNode**（`field.kind`）：

| schema 写法                                                                       | 节点 kind     | 说明                           | 默认组件        |
| --------------------------------------------------------------------------------- | ------------- | ------------------------------ | --------------- |
| `type: "string" / "number" / "boolean"`（或任意未识别的自定义 type，如 `"tags"`） | `"primitive"` | 叶子字段，持有单个响应式值     | `Input`         |
| `type: "object"` + `properties`                                                   | `"object"`    | 分组容器，值由子字段聚合       | `ObjectField`   |
| `type: "array"` + `items.type === "object"`                                       | `"array"`     | **对象数组**，每行是一组子字段 | `ArrayCards`    |
| 含 `"x-layout"`                                                                   | `"void"`      | 布局节点，不占数据路径         | `x-layout` 的值 |

> **重要约束**：`type: "array"` 只支持 `items` 为**单个对象** schema（`items.type === "object"`）。基本类型的数组（多选、标签等）不要用 `array`，请用一个 primitive 字段并在组件里用 JSON 字符串承载，例如值存成 `'["a","b"]'`。`items` 写成数组（tuple 形式）不会被展开。

- **primitive** 有 `value` 信号和 `setValue()`。
- **object** / **void** 有 `children: Map<string, FieldNode>`。
- **array** 有 `rows: Signal<RowNode[]>` 和 `push/remove/move/...`。每个 `RowNode` 有自己的 `children`。

### void 布局节点（x-layout）

带 `x-layout` 的节点是 **void（虚字段）**：它只负责视觉分组/布局，**不占数据路径、不产生值**——子字段的路径和值会**扁平上浮到父级**。判定优先于 `type`。

```ts
const form = createForm({
  schema: {
    type: "object",
    properties: {
      section: {
        "x-layout": "Card", // 该节点是 void，默认渲染组件名 = "Card"
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
    },
  },
  initialValues: { email: "a@b.com", phone: "123" }, // 注意：直接挂在顶层，而非 section 下
});

form.field("section")?.kind; // "void"
form.field("email"); // 存在（路径没有 section 前缀）
await form.submit(); // { email: "...", phone: "123" }
```

顶层 `IFormSchema` 也支持 `x-layout`，用单个 schema 声明整页布局。

### `$ref` 与 `definitions` 复用

可复用的 schema 片段放进 `definitions`，字段用 `$ref: "#/definitions/名字"` 引用。本地属性会**覆盖**被引用定义里的同名属性（local wins）。

```ts
const form = createForm({
  schema: {
    type: "object",
    definitions: {
      Money: { type: "number", component: "MoneyInput" },
    },
    properties: {
      price: { $ref: "#/definitions/Money", title: "价格" }, // title 覆盖，其余继承
    },
  },
});
```

`definitions` 既可以写在 schema 里，也可以放进 `createForm` 的 `config.definitions`。两者合并，**config 同名定义覆盖 schema 定义**。注意：`config.definitions` 只有通过**显式 `$ref`** 才会生效，不会按字段名自动套用。`$ref` 链会被递归解析，并能检测直接/间接**循环引用**（不会栈溢出，会通过 `onError` 报告一次）。

### 字段排序 order

同级字段按 `order` 升序排列，没写 `order` 的排在最后（视为 `Infinity`）。core 用 `sortByOrder` 保证构建顺序，UI 层渲染顺序也一致。

---

## `createForm(config)`

唯一的工厂函数。所有参数都是可选的。

```ts
function createForm(config?: FormConfig): FormInstance;

interface FormConfig {
  schema?: IFormSchema; // 表单结构，缺省为空 object
  definitions?: Record<string, IFieldSchema>; // 额外的 $ref 定义（覆盖 schema.definitions）
  initialValues?: Record<string, any>; // 初始值（按点路径匹配字段）
  scope?: Record<string, any>; // 注入 $service/$utils/$enums/$query 命名空间
  onError?: (error: FormError) => void; // 规则/解析错误回调
}
```

- **`initialValues`** 按点路径填充：`{ user: { name: "x" } }` 会填到字段 `user.name`。数组字段会据此生成对应行数。
- **`scope`** 只读取 `$service`、`$utils`、`$enums`、`$query` 四个命名空间；其他键不会进入表达式作用域。

> `createForm` 构建完字段树后，**响应式规则默认还没启动**，需要调用 `form.mount()`。（`@alien-form/react` 的 `useCreateForm` 会自动挂载。）

---

## FormInstance：表单实例 API

### 响应式状态（都是 signal / computed，调用即读取）

| 成员         | 类型                             | 含义                                         |
| ------------ | -------------------------------- | -------------------------------------------- |
| `schema`     | `IFormSchema`                    | 归一化后的 schema（含合并后的 definitions）  |
| `root`       | `ObjectFieldNode`                | 字段树根节点                                 |
| `fields`     | `Signal<Map<string, FieldNode>>` | 拍平的 `path -> 节点` 表；数组增删行时会变更 |
| `submitting` | `Signal<boolean>`                | 是否正在 `submit()`                          |
| `values`     | `Computed<Record<string, any>>`  | 当前完整值（已应用 `x-format.output`）       |
| `errors`     | `Computed<FieldError[]>`         | 所有可见字段的错误汇总                       |
| `valid`      | `Computed<boolean>`              | `errors().length === 0`                      |

### 取值 / 写值

```ts
form.field(path: string): FieldNode | undefined  // 按精确路径取节点
form.get(selector: string): any                  // 按选择器读值（见下文 Selector）
form.set(selector: string, value: any): void     // 按选择器写值（只能写到 primitive）
form.project(selector?: string): any             // 投影：无参=整表值；有参=该字段投影值
form.setValues(values): void                     // 批量按路径写入 primitive / 数组行
form.setInitialValues(values): void              // 只改「初始值基线」，不改当前值
form.reset(): void                               // 递归重置到 schema.default，并清空错误
```

- `get` / `set` 用的是 **selector**，支持相对路径、`$row.`、`[].` 集合广播等（见 [Selector](#selector选择器语法)）。
- `set` 只能写到叶子（primitive）字段；写到 object / 越界索引会通过 `onError` 报错但**不抛异常、不产生幽灵行**。
- `project()` 与 `values()` 的区别：`project` 用于按需拿某个子树的输出值；`values()` 是整表的响应式计算值。

```ts
form.setValues({ a: 10, list: [{ v: "x" }, { v: "y" }] }); // 数组会重建为 2 行
form.setInitialValues({ a: 50 }); // 只影响下次 reset 的基线，当前值不变
```

### 生命周期

```ts
form.mount(): void      // 启动所有 x-reaction / x-effect（幂等，销毁后不再挂载）
form.unmount(): void    // 停止所有规则，但保留字段树（可再 mount）
form.destroy(): void    // 彻底销毁：unmount + 释放字段树 + 清空监听器
```

规则在 mount 之前不会运行（测试中 `spy` 不会被调用）；`unmount` 后可再次 `mount`，字段不丢失。

### 校验与提交

```ts
form.validate(): Promise<boolean>
// 并发校验所有 display !== "none" 的字段，全通过返回 true

form.submit<T>(onSubmit?: (values) => T | Promise<T>): Promise<T>
// 先 validate；失败则 reject（error.messages 是错误消息数组）
// 成功则：有 onSubmit 就用最终值调用它并返回其结果；否则直接返回最终值
// 全程 form.submitting() 为 true，结束后恢复 false
```

```ts
try {
  const saved = await form.submit(async (values) => api.save(values));
} catch (err) {
  console.log(err.messages); // ["该字段为必填项", ...]
}
```

### 订阅与副作用：`form.effect`

两种重载：

**1) runner 形式**——注册一个响应式 runner，读到的 signal 变化就重跑；返回销毁函数；可返回 cleanup。

```ts
const dispose = form.effect((f) => {
  console.log("a 变了：", f.get("a"));
});
dispose(); // 停止

form.effect(() => {
  const timer = setInterval(...);
  return () => clearInterval(timer); // runner 返回的 cleanup 由框架托管，destroy 时调用
});
```

**2) selector + listener 形式**——只在选中值变化时触发 listener，类似 watch。

```ts
form.effect(
  (f) => f.get("a"), // selector
  (next, prev) => console.log(next, prev), // 变化时触发
  { immediate: true, equals: Object.is }, // 可选：立即执行一次 / 自定义相等比较
);
```

默认**不**在初始化时触发（除非 `immediate: true`）；`equals` 返回 `true` 视为无变化、跳过 listener。

### 错误监听

```ts
const off = form.onError((e: FormError) => console.warn(e.scope, e.path, e.message));
off(); // 取消订阅
```

---

## FieldNode：字段节点 API

所有节点共享 `BaseFieldNode`，四种 kind 各自扩展。字段的每项「能力」都是一个 signal——**调用无参读取**，通过对应的 `setXxx` 写入（`setXxx` 内部做了相等判断，避免无谓通知）。

### 公共属性（BaseFieldNode）

| 属性                    | 类型                                                              | setter                                       |
| ----------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `id`                    | `string`                                                          | —                                            |
| `path`                  | `string`                                                          | —（数组重排时框架内部维护）                  |
| `schema`                | `IFieldSchema`                                                    | —                                            |
| `kind`                  | `"primitive" \| "object" \| "array" \| "void"`                    | —                                            |
| `parent` / `row`        | 节点 / 所属行                                                     | —                                            |
| `display`               | `Signal<"visible" \| "hidden" \| "none">`                         | `setDisplay(v)`                              |
| `disabled`              | `Signal<boolean>`                                                 | `setDisabled(v)`                             |
| `required`              | `Signal<boolean>`                                                 | `setRequired(v)`                             |
| `errors`                | `Signal<FieldError[]>`                                            | `setErrors(list)`（并联动 `validateStatus`） |
| `warnings`              | `Signal<FieldError[]>`                                            | `setWarnings(list)`                          |
| `validateStatus`        | `Signal<"success" \| "error" \| "warning" \| "validating" \| "">` | 随 `setErrors` 自动更新                      |
| `title` / `description` | `Signal<string>`                                                  | 直接调用 signal 写入                         |
| `component`             | `Signal<string>`                                                  | `setComponent(name, props?)`                 |
| `componentProps`        | `Signal<Record<string, any>>`                                     | 同上 / reaction                              |
| `decorator`             | `Signal<string>`（默认 `"FormItem"`）                             | `setDecorator(name, props?)`                 |
| `decoratorProps`        | `Signal<Record<string, any>>`                                     | 同上                                         |
| `dataSource`            | `Signal<DataSourceItem[]>`                                        | `setDataSource(ds)`                          |
| `loading`               | `Signal<boolean>`                                                 | `setLoading(v)`                              |

公共方法：

```ts
field.validate(): Promise<FieldError[]>  // 校验单个字段（必填判空 + x-validate）
field.reset(): void                       // primitive 回 default；array 回 default 行；容器递归重置
field.dispose(): void                     // 释放该字段（含子树/行）并从 fields 表移除
```

必填判空使用内部的空值判断：`undefined` / `null` / `""` / `[]` 视为空（`0`、`false`、`{}` 不算空）。

### PrimitiveFieldNode

```ts
field.value: Signal<any>;
field.setValue(value: string | number | boolean | null | undefined): void;
```

`setValue` 有**写入守卫**：只接受 `string | number | boolean`；`null` / `undefined` 视为清空放行；传入对象或数组会**抛 `TypeError`**（提示你拆字段或序列化）。

```ts
const name = form.field("name");
if (name?.kind === "primitive") {
  name.setValue("hi"); // ✅
  name.setValue({ a: 1 }); // ❌ 抛 TypeError
}
```

### ArrayFieldNode

```ts
field.rows: Signal<RowNode[]>;
field.push(initialValues?: any): void;   // 追加一行（可带初始值）
field.remove(index: number): void;       // 删除某行并重排索引
field.move(from: number, to: number): void;
field.moveUp(index: number): void;
field.moveDown(index: number): void;
field.setRows(values: any[]): void;      // 整体替换所有行
```

所有越界操作都是**安全的 no-op**（不抛错）。删除/移动会重新计算各行及嵌套子字段的 `path`。

```ts
const list = form.field("materials"); // kind === "array"
list.push({ name: "新素材" });
list.remove(0);
form.get("materials[].name"); // 用集合选择器一次读所有行的 name
```

`RowNode` 结构：`{ id, index, path, parent, children: Map<string, FieldNode> }`。

### ObjectFieldNode / VoidFieldNode

```ts
field.children: Map<string, FieldNode>;
```

二者结构相同，区别在语义：object 会占据数据路径并在投影中保留 `{}`（哪怕子节点全空），void 则把子节点扁平上浮到父级。

---

## Selector：选择器语法

`form.get` / `form.set` 使用同一套选择器：

| 选择器        | 含义                                                           | 示例                           |
| ------------- | -------------------------------------------------------------- | ------------------------------ |
| `a.b.c`       | 绝对路径（对 root 而言）                                       | `form.get("user.name")`        |
| `a.0.b`       | 数组按下标定位某行的子字段                                     | `form.get("materials.0.name")` |
| `arr[].child` | **集合选择器**：读=返回每行该子字段组成的数组；写=广播到每一行 | `form.get("materials[].name")` |

读写对齐（get/set parity）：能这么读，就能这么写。集合选择器写入是**广播**——把同一个值写进每一行的该子字段。

```ts
// 读：所有行的 name
form.get("materials[].name"); // ["a", "b", "c"]
// 写：广播到所有行
form.set("materials[].name", "Z"); // 每行 name 都变成 "Z"

// 嵌套集合读
form.get("contacts[].phones.0.number"); // 每个联系人的第 0 个电话号
```

对非 primitive / 非数组的错误用法（如 `set` 一个 object、集合选择器指向非数组字段、越界下标），会通过 `onError` 报错，不抛异常。

---

## 响应式规则

四种规则都写在 schema 上，规则值都遵循同一套「[三种写法](#规则值的三种写法)」，函数在运行时收到同一个 [ExpressionScope](#expressionscope规则运行时作用域)。

### 规则值的三种写法

任何规则位置（`x-reaction` 的每个 target、`x-effect`、`x-format.input/output`、`x-validate`）都接受：

1. **内联函数** `(scope) => any`。
2. **`{{ 表达式 }}` 字符串**——由 `compileExpr` 编译的 JavaScript 表达式。
3. **字面量**——普通字符串、数字、对象等，直接作为结果值。

```ts
// 1) 内联函数
{ "x-reaction": { value: ({ $values }) => ($values.a ?? 0) + 1 } }
// 2) 表达式
{ "x-reaction": { display: "{{ $values.toggle ? 'visible' : 'none' }}" } }
// 3) 字面量
{ "x-reaction": { value: "literal-text" } }  // value 直接变成这段文本
{ "x-reaction": { props: { placeholder: "hi" } } } // 对象直接作为 props payload
```

每个 target 也可以传**规则数组**，依次执行；对同一 target，后者覆盖前者。

### x-reaction 字段联动

`x-reaction` 是一个「target → 规则」的映射。每条规则跑在一个 signal effect 里，**读到的响应式源变化时自动重算**，并把结果写到对应能力上。结果为 `undefined` 时**跳过**（不覆盖）。支持的 target：

| target                  | 作用                            | 备注                          |
| ----------------------- | ------------------------------- | ----------------------------- |
| `value`                 | 写字段值                        | **仅 primitive**；否则报错    |
| `rows`                  | 设置数组行                      | **仅 array**；否则报错        |
| `display`               | `"visible" / "hidden" / "none"` |                               |
| `disabled`              | 布尔                            |                               |
| `required`              | 布尔                            |                               |
| `title` / `description` | 文案                            |                               |
| `props`                 | 合并进 `componentProps`         | 浅合并                        |
| `decoratorProps`        | 合并进 `decoratorProps`         | 浅合并                        |
| `component`             | 换组件                          | 字符串或 `[name, props]` 元组 |
| `decorator`             | 换装饰器                        | 字符串或 `[name, props]` 元组 |
| `dataSource`            | 设置选项                        | 不修改当前字段值              |

```ts
const form = createForm({
  schema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number", "x-reaction": { value: "{{ $values.a * 2 }}" } },
      toggle: { type: "boolean" },
      secret: {
        type: "string",
        "x-reaction": { display: "{{ $values.toggle ? 'visible' : 'none' }}" },
      },
    },
  },
  initialValues: { a: 3, toggle: false },
});
form.mount();
form.get("b"); // 6
form.set("a", 10);
form.get("b"); // 20（自动重算）
form.set("toggle", true); // secret 变为可见
```

规则支持**异步**：返回 Promise 时，resolve 后再写入；若字段/表单已销毁，过期的异步结果会被丢弃；reject 会走 `onError`。

### x-effect 副作用

`x-effect` 用来跑不直接映射到某个 target 的副作用（订阅、拉数据、注册 watcher 等）。规则可**返回一个清理函数**（或 Promise<清理函数>），会在 `destroy` 时调用。

```ts
{
  a: { type: "number" },
  b: {
    type: "number",
    "x-effect": ({ $values, $utils }) => $utils.log($values.a),
  },
}
```

### x-format 输入/输出格式化

`x-format` 在值「进/出」时做转换，**必须同步**（返回 Promise 会被拒绝并走 onError，同时回退原值）：

- `input`：**仅在初始化时**对初始值格式化一次（之后用户输入不再经过 input）。
- `output`：在投影/`values()`/`submit()` 取值时对输出值格式化。

```ts
{
  name: {
    type: "string",
    "x-format": {
      input: ({ $value }) => (typeof $value === "string" ? $value.trim() : $value),
      output: ({ $value }) => `[${$value}]`,
    },
  },
}
// 初始值 "  Alice  " 会被 trim 成 "Alice"；提交时再套上括号
```

### x-validate 自定义校验

`x-validate` 在 `field.validate()` / `form.validate()` / `submit()` 时执行（可异步）。返回值被归一化成错误列表：

- `undefined` / `null` / `true` → 通过（无错）
- `false` → 一条 `"Invalid value"` 错误
- 字符串 → 一条该文案的错误
- `{ message, type? }` 对象 → 一条错误（`type` 默认 `"x-validate"`）
- 以上的数组 → 逐条归一化，通过项跳过

```ts
{
  username: {
    type: "string",
    "x-validate": async ({ $value, $service }) =>
      (await $service.users.exists($value)) ? "用户名已被占用" : true,
  },
}
```

必填校验是内建的（`required` 为真且值为空时报 `"该字段为必填项"`），与 `x-validate` 叠加。

### ExpressionScope：规则运行时作用域

每条规则只接收一个 `scope` 参数。作用域形状固定，不会展开整表值或兄弟字段：

```ts
interface ExpressionScope {
  $values: Record<string, any>;
  $self: FieldNode;
  $form: FormInstance;
  $value: any;
  $row: Record<string, any> | undefined;
  $path: string;
  $service: Record<string, any>;
  $utils: Record<string, any>;
  $enums: Record<string, any>;
  $query: Record<string, any>;
}
```

---

## 表达式语言 `{{ }}`

`{{ ... }}` 由 `compileExpr` 基于 `new Function` 编译，并按源码缓存。它支持标准
JavaScript 表达式，包括函数调用和箭头函数；Schema 必须来自可信来源。

表达式只能直接访问固定的 `ExpressionScope` 名称：

- `$values`：当前整表值。
- `$self`、`$form`、`$value`、`$row`、`$path`：当前字段上下文。
- `$service`、`$utils`、`$enums`、`$query`：由 `FormConfig.scope` 注入的命名空间。

```ts
{ secret: { type: "string", "x-reaction": { display: "{{ $values.toggle ? 'visible' : 'none' }}" } } }
{ total: { type: "number", "x-reaction": { value: "{{ $values.price * $values.qty }}" } } }
{ options: { type: "string", dataSource: "{{ $service.catalog.options($values.category) }}" } }
```

`compileExpr(raw)` 返回 `(scope) => value`；`evaluateExpression(raw, scope)` 用于直接求值。

---

## 数据源

`dataSource` 接受静态选项数组、`{{ }}` 表达式或单参数函数。异步规则执行期间
`field.loading()` 为 `true`，较旧的异步结果会被丢弃。`normalizeDataSource` 会把几种常见形态归一化：

- 纯字符串/数字 `["a", 1]` → `[{ label: "a", value: "a" }, { label: "1", value: 1 }]`
- `{ key, title }` 形态 → `{ label: title, value: key, ...原字段 }`
- 已是 `{ label, value }` → 原样保留

core 更新选项时不会修改字段值。清空非法值、保留原值或默认选择首项等交互策略由
Select 等具体组件通过自身 props 实现。

---

## 校验与提交

- `field.validate()`：校验单个字段（必填 + `x-validate`），写回 `errors` 并返回错误数组。
- `form.validate()`：并发校验所有 `display !== "none"` 的字段，全通过返回 `true`。
- `form.errors()`：汇总所有可见字段的错误。
- `form.submit(onSubmit?)`：先校验，失败 reject（`error.messages` 为消息数组），成功用最终值调用 `onSubmit` 并返回其结果（无 `onSubmit` 则返回最终值）；全程维护 `submitting`。

`display === "none"` 的字段既不参与校验，其值也**不进入投影**（相当于逻辑删除）；`hidden` 只是视觉隐藏，值仍保留。

---

## 错误处理 onError

规则执行、`$ref` 解析、表达式求值、非法 `set` 等都会产生一条 `FormError`，通过 `config.onError` 或 `form.onError()` 上报——**不会中断表单**。

```ts
interface FormError {
  scope:
    | "reaction"
    | "x-reaction"
    | "x-effect"
    | "x-format"
    | "x-validate"
    | "ref-resolve"
    | "expression";
  path: string;
  key?: string;
  message: string;
  cause?: unknown;
}
```

```ts
const form = createForm({
  schema: {
    type: "object",
    properties: { a: { type: "string", "x-reaction": { value: "@missing" } } },
  },
  onError: (e) => console.warn(`[${e.scope}] ${e.path}: ${e.message}`),
});
form.mount(); // 触发 "Handler \"missing\" not found."
```

---

## 工具函数导出

除了 `createForm`，core 还导出一批纯函数和 signal 原语，供高级用法：

| 导出                                                      | 说明                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `signal`, `computed`, `effect`, `startBatch`, `endBatch`  | 从 alien-signals 再导出的响应式原语                                          |
| `resolveSchemaRef(schema, definitions, onError?, seen?)`  | 解析单个节点的 `$ref` 链（含循环检测），返回 `{ schema, fromRef, consumed }` |
| `resolveSchemaTree(schema, definitions, onError?, seen?)` | 递归解析整棵 schema 树里的所有 `$ref`                                        |
| `getDeepValue(obj, path)`                                 | 按点路径读深层值（支持数组下标段）                                           |
| `setDeepValue(obj, path, value)`                          | 按点路径写深层值（缺失层自动建对象/数组）                                    |
| `sortByOrder(properties)`                                 | 按 `order` 升序返回 `[key, schema]` 列表                                     |
| `compileExpr(raw)` / `evaluateExpression(raw, scope)`     | 编译或直接求值 JavaScript 表达式                                             |
| `normalizeDataSource(ds)`                                 | 归一化数据源为 `{ label, value }[]`                                          |
| `isEmptyValue(value)`                                     | 判空（`undefined/null/""/[]` 为空）                                          |

```ts
import { getDeepValue, evaluateExpression, isEmptyValue } from "@alien-form/core";

getDeepValue({ list: [{ v: "x" }] }, "list.0.v"); // "x"
evaluateExpression("a > 5 ? 'big' : 'small'", { a: 10 }); // "big"
isEmptyValue([]); // true
```

---

## 完整类型速查表

以下类型均从包入口导出，可 `import type { ... } from "@alien-form/core"`：

`Signal`, `Computed`, `FieldNode`, `FieldAtoms`, `BaseFieldNode`, `PrimitiveFieldNode`, `ObjectFieldNode`, `ArrayFieldNode`, `VoidFieldNode`, `RowNode`, `FieldKind`, `PrimitiveSchemaType`, `FormInstance`, `FormConfig`, `FormError`, `FormErrorScope`, `IFormSchema`, `IFieldSchema`, `FieldError`, `DataSourceItem`, `FieldDisplayTypes`, `ValidateStatus`, `SchemaTypes`, `SchemaRuntimeValue`, `SchemaEffect`, `SchemaReactions`, `SchemaFormat`, `SchemaXValidate`, `SchemaReactionKey`, `RuntimeRuleContext`, `ExpressionScope`, `CompiledExpression`, `ResolveRefResult`。

---

## License

MIT
