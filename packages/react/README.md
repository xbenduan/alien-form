# @alien-form/react

`@alien-form/core` 的 **React 绑定**。它把 core 的信号（signal）字段树接到 React 的渲染上，提供一整套 Hooks、一个 `<FormProvider>` 上下文，以及一个把 schema 自动渲染成表单的 `<SchemaField>`。

> **这是 React 项目唯一需要安装的包**——它已经把 `@alien-form/core` 的全部 API（含 `createForm` 和所有类型）再导出，你不必单独依赖 core。核心概念（schema、字段树、selector、x-reaction/x-effect/x-format/x-validate、表达式等）请参考 core 的 README，本文只讲 React 层。

---

## 目录

- [安装](#安装)
- [30 秒上手](#30-秒上手)
- [两种用法：自动渲染 vs 手写字段](#两种用法自动渲染-vs-手写字段)
- [创建与提供表单](#创建与提供表单)
  - [`useCreateForm(config, deps)`](#usecreateformconfig-deps)
  - [`<FormProvider>`](#formprovider)
  - [`useForm()`](#useform)
- [Schema 自动渲染](#schema-自动渲染)
  - [`<SchemaField>`](#schemafield)
  - [Component / Decorator：组件与装饰器约定](#component--decorator组件与装饰器约定)
  - [各类字段传给组件的 props](#各类字段传给组件的-props)
- [字段级 Hooks](#字段级-hooks)
- [表单级 Hooks](#表单级-hooks)
- [底层订阅 Hooks](#底层订阅-hooks)
- [导出一览](#导出一览)

---

## 安装

```bash
pnpm add @alien-form/react
# React 18 或 19 作为 peerDependency，需要你的项目自带
```

`react` 是 peer 依赖（`^18 || ^19`）。`@alien-form/core` 作为普通依赖被一起带入。

---

## 30 秒上手

```tsx
import {
  useCreateForm,
  FormProvider,
  SchemaField,
  useFormSubmit,
  type IFormSchema,
  type ComponentMap,
  type DecoratorMap,
} from "@alien-form/react";

const schema: IFormSchema = {
  type: "object",
  properties: {
    name: { type: "string", title: "姓名", required: true },
    age: { type: "number", title: "年龄", component: "NumberInput" },
  },
};

// 1) 你提供「组件名 -> React 组件」的映射
const components: ComponentMap = {
  Input: (p) => (
    <input
      value={p.value ?? ""}
      disabled={p.disabled}
      onChange={(e) => p.onChange(e.target.value)}
    />
  ),
  NumberInput: (p) => (
    <input
      type="number"
      value={p.value ?? ""}
      onChange={(e) => p.onChange(Number(e.target.value))}
    />
  ),
};
const decorators: DecoratorMap = {
  FormItem: (p) => (
    <label>
      {p.label}
      {p.required && " *"}
      {p.children}
      {p.errors?.map((e: any, i: number) => (
        <span key={i} style={{ color: "red" }}>
          {e.message}
        </span>
      ))}
    </label>
  ),
};

function MyForm() {
  const form = useCreateForm({ schema, initialValues: { name: "Alien" } }, []);
  const { submit, submitting } = useFormSubmit();
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
      <button disabled={submitting} onClick={() => submit((values) => console.log(values))}>
        提交
      </button>
    </FormProvider>
  );
}
```

---

## 两种用法：自动渲染 vs 手写字段

1. **Schema 驱动自动渲染**：用 `<SchemaField>` 让库遍历 schema、逐字段渲染。你只需提供 `components` / `decorators` 映射。适合表单结构完全由 schema 描述的场景。

2. **手写 React + Hooks**：不用 `<SchemaField>`，自己写 JSX，用 `useFieldValue` / `useFieldErrors` / `form.set(...)` 等 Hooks 精确控制每个字段的渲染。适合高度定制的 UI。

两者可以混用（都在同一个 `<FormProvider>` 下），共享同一个 `FormInstance`。

---

## 创建与提供表单

### `useCreateForm(config, deps)`

在组件里创建一个 `FormInstance` 并托管其生命周期。

```ts
function useCreateForm(config?: FormConfig, deps?: React.DependencyList): FormInstance;
```

- 内部用 `useMemo(() => createForm(config), deps)` 创建实例——**是否重建完全由你传入的 `deps` 决定**。
- 首次挂载会 `form.mount()`（启动所有 x-reaction / x-effect）；`deps` 变化产生新实例时，会自动 `destroy()` 旧实例，`mount()` 新实例。
- 兼容 React `StrictMode` 的双次挂载：重挂后当前实例仍然存活可用，不会被误销毁。
- 组件卸载时 `unmount()`。

```tsx
// schema 会随某个业务 key 变化而重建表单
const form = useCreateForm({ schema, initialValues }, [pageKey]);
```

> 若 `deps` 里没包含会变化的 `config` 内容，表单不会重建——这是刻意的：把重建控制权交给你，避免因引用变化导致的意外重建或校验失效。

也支持通过 `config.definitions` 透传 `$ref` 定义（同 core），且仅在显式 `$ref` 下生效。

### `<FormProvider>`

把 `form` 实例，以及组件/装饰器映射，通过 context 提供给子树。

```tsx
interface FormProviderProps {
  form: FormInstance;
  components?: ComponentMap; // Record<string, React.ComponentType<any>>
  decorators?: DecoratorMap; // Record<string, React.ComponentType<any>>
  children?: React.ReactNode;
}
```

`components` / `decorators` 通过 ref 读取最新值，因此在渲染中传入新对象也不会造成 context 频繁失效。

### `useForm()`

在 `<FormProvider>` 内的任意后代拿到当前 `FormInstance`（不在 Provider 内会抛错）。

```tsx
const form = useForm();
form.set("name", "new");
```

---

## Schema 自动渲染

### `<SchemaField>`

遍历 `form.schema` 并渲染所有字段。必须放在 `<FormProvider>` 内。

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField />
</FormProvider>
```

渲染规则（与 core 的字段类型一一对应）：

- **primitive 字段** → 用 `components[component]` 渲染，外面套 `decorators[decorator]`（默认 `FormItem`）。
- **object 字段**：写了 `component` 就用该组件包裹子字段；否则**直接展开渲染子字段**（不额外包一层）。
- **array 字段** → 用 `components[component]`（默认组件名 `ArrayCards`）渲染，库会把每行子字段预渲染好交给它。
- **void 字段（`x-layout`）** → 用 `components[x-layout 名]` 作为布局组件包裹子字段；组件没注册时**降级为直接渲染子字段**，不崩溃。
- 顶层 `x-layout`：整个 `<SchemaField>` 外层套一个布局组件（同样支持降级）。

`display` 的处理：`"none"` → 不渲染（返回 `null`）；`"hidden"` → 渲染一个 `display:none` 的占位，字段值仍保留。

组件名在 `components` 里找不到时，primitive 会渲染一个红色的 `Unknown: <名字>` 提示，便于排查。

### Component / Decorator：组件与装饰器约定

- **Component（组件）**：真正的输入控件，如 Input、Select、Switch。由 schema 的 `component` 指定名字，你在 `components` 映射里给出实现。
- **Decorator（装饰器）**：包裹控件的外壳，负责 label、必填星号、错误信息、描述等，如 `FormItem`。由 schema 的 `decorator`（默认 `"FormItem"`）指定。

```ts
export type ComponentMap = Record<string, React.ComponentType<any>>;
export type DecoratorMap = Record<string, React.ComponentType<any>>;
```

### 各类字段传给组件的 props

库会把字段的响应式能力打平成 props 传给你的组件。你只需按需读取。

**Primitive 组件**收到：

```ts
{
  ...componentProps,          // schema.props / x-reaction.props 累积的自定义 props
  value,                      // 当前值
  onChange: (v) => void,      // 写回字段值（等价 field.setValue）
  disabled,
  loading,
  dataSource?,                // 仅当有选项时才带上（{ label, value }[]）
}
```

对应的 **Decorator** 收到：`label`(=title)、`required`、`errors`、`warnings`、`description`、`validateStatus`，以及展开的 `decoratorProps`，`children` 是渲染好的控件。

**Array 组件**收到：

```ts
{
  ...componentProps,
  field,                      // ArrayFieldNode 本体
  rows,                       // React.ReactNode[][]：每行的子字段节点数组
  rowNodes,                   // RowNode[]：原始行节点（含 id，可做 key）
  rowFields,                  // Record<string, ReactNode>[]：每行「子字段名 -> 渲染节点」
  onAdd: (iv?) => void,       // 追加一行
  onRemove: (i) => void,
  onMoveUp: (i) => void,
  onMoveDown: (i) => void,
  onMove: (from, to) => void,
  disabled,
}
```

未注册 array 组件时，库提供一个极简回退：逐行渲染 + 一个「+ Add」按钮。

**Object 组件**（object 字段写了 `component` 时）收到：

```ts
{
  ...componentProps,
  field,                      // ObjectFieldNode
  fields,                     // Record<string, ReactNode>：子字段名 -> 渲染节点
  title,
  description,
  children,                   // 已渲染的全部子字段
}
```

**Void/Layout 组件**（`x-layout`）收到：`title`、`description`、展开的 `componentProps`，`children` 为子字段。

---

## 字段级 Hooks

这些 Hook 按 `path` 订阅某个字段的**单项能力**，只有该项变化才触发重渲染。字段不存在时返回安全默认值（不会抛错）。

| Hook                     | 返回                              | 说明                                               |
| ------------------------ | --------------------------------- | -------------------------------------------------- |
| `useFieldAtoms(path)`    | `FieldNode \| undefined`          | 拿到字段节点本身（可直接调它的方法/读它的 signal） |
| `useFieldValue(path)`    | `any`                             | 字段值（非 primitive 字段返回 `undefined`）        |
| `useFieldErrors(path)`   | `FieldError[]`                    | 该字段的错误列表                                   |
| `useFieldDisplay(path)`  | `"visible" \| "hidden" \| "none"` | 显示状态                                           |
| `useFieldDisabled(path)` | `boolean`                         | 是否禁用                                           |
| `useFieldRequired(path)` | `boolean`                         | 是否必填                                           |
| `useFieldLoading(path)`  | `boolean`                         | 是否加载中                                         |

```tsx
function NameField() {
  const form = useForm();
  const value = useFieldValue("name");
  const errors = useFieldErrors("name");
  const required = useFieldRequired("name");
  return (
    <div>
      <input value={value ?? ""} onChange={(e) => form.set("name", e.target.value)} />
      {required && <span>*</span>}
      {errors.map((e, i) => (
        <em key={i}>{e.message}</em>
      ))}
    </div>
  );
}
```

---

## 表单级 Hooks

按整表状态订阅（都基于 core 的 computed / signal）：

| Hook                  | 返回                     | 说明                                                         |
| --------------------- | ------------------------ | ------------------------------------------------------------ |
| `useFormValues()`     | `Record<string, any>`    | 当前完整值（响应式）                                         |
| `useFormValid()`      | `boolean`                | 是否全部校验通过                                             |
| `useFormErrors()`     | `FieldError[]`           | 所有可见字段的错误汇总                                       |
| `useFormSubmitting()` | `boolean`                | 是否正在提交                                                 |
| `useFormSubmit<T>()`  | `{ submit, submitting }` | `submit(onSubmit?)` 触发校验+提交；`submitting` 为响应式状态 |
| `useFormValidate()`   | `{ validate }`           | `validate()` 手动触发整表校验，返回 `Promise<boolean>`       |

```tsx
function SubmitBar() {
  const { submit, submitting } = useFormSubmit();
  const valid = useFormValid();
  return (
    <button disabled={submitting || !valid} onClick={() => submit((v) => api.save(v))}>
      {submitting ? "提交中…" : "提交"}
    </button>
  );
}
```

---

## 底层订阅 Hooks

### `useSignalValue(sig)`

把任意 core 的 `Signal<T>` 或 `Computed<T>` 桥接成 React 状态（基于 `useSyncExternalStore`，signal 变化时组件重渲染）。前面所有字段/表单级 Hook 都建立在它之上。

```tsx
const submitting = useSignalValue(form.submitting);
const b = useSignalValue(form.field("b")!.errors);
```

需要订阅一个库没有现成 Hook 覆盖的 signal 时用它。

---

## 导出一览

**值/函数：**
`useSignalValue`, `useCreateForm`, `useForm`, `FormProvider`, `FormContext`, `SchemaField`,
`useFieldAtoms`, `useFieldValue`, `useFieldErrors`, `useFieldDisplay`, `useFieldDisabled`, `useFieldRequired`, `useFieldLoading`,
`useFormValues`, `useFormValid`, `useFormSubmitting`, `useFormErrors`, `useFormSubmit`, `useFormValidate`,
以及从 core 再导出的 `createForm`。

**类型：**
`ComponentMap`, `DecoratorMap`，以及从 core 再导出的
`Signal`, `Computed`, `FormInstance`, `FormConfig`, `FieldNode`, `PrimitiveFieldNode`, `ObjectFieldNode`, `ArrayFieldNode`, `VoidFieldNode`, `RowNode`, `IFormSchema`, `IFieldSchema`, `FieldError`, `DataSourceItem`, `FieldDisplayTypes`, `ValidateStatus`, `SchemaReactions`, `SchemaFormat`, `SchemaXValidate`, `SchemaReactionKey`, `RuntimeRuleContext`, `ExpressionScope`, `SchemaTypes`, `FormErrorScope`。

---

## License

MIT
