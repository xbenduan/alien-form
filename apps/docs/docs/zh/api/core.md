# Core API

`@formily-bao/core` 当前只导出两个运行时实体和一组类型：`createForm`、`Form`、`Field` 以及 `IForm`、`IField`、`IFormSchema`、`IFieldSchema`、`RuntimeRuleHandler` 等类型定义。

## 导出总览

| 导出 | 类型 | 用途 |
| --- | --- | --- |
| `createForm(config?)` | 函数 | 创建 `Form` 实例，推荐业务代码直接使用 |
| `Form` | 类 | `createForm()` 的底层实现，适合调试或扩展时阅读 |
| `Field` | 类 | 字段状态与数组操作实现 |
| `FormConfig` | 类型 | 表单构造配置 |
| `RuntimeRuleHandler` | 类型 | `x-reaction` / `x-format` / `x-validate` 的 `computed` handler 签名 |
| `FormError` | 类型 | 非致命协议错误的统一上报结构 |

## createForm

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { contactType: 'email' },
  handlers: {
    fetchCategories: async () => [],
  },
  effects(form) {
    form.onValuesChange((values) => {
      console.log(values)
    })
  },
  onError(error) {
    console.warn(error)
  },
})
```

### FormConfig

| 字段 | 类型 | 当前实现说明 |
| --- | --- | --- |
| `initialValues` | `Record<string, any>` | 初始值源，会在 `createField()` 时参与 default 合并 |
| `validateFirst` | `boolean` | 类型已声明，但当前 `Form.validate()` 尚未使用该选项做短路 |
| `effects` | `(form) => void` | 在 `Form` 构造函数里立即执行一次，可注册生命周期监听 |
| `scope` | `Record<string, any>` | 注入表达式作用域，供 `$self`、`$values` 之外的自定义变量使用 |
| `handlers` | `Record<string, RuntimeRuleHandler>` | 给 `computed` 规则查找实现 |
| `onError` | `(error: FormError) => void` | 接收联动、表达式、`$ref`、格式化等非致命错误 |

## Form 实例

### 只读状态

| 属性 | 说明 |
| --- | --- |
| `fields` | `Map<string, IField>`，当前所有字段注册表 |
| `values` | 过滤 `display: none`、数组子字段、void 字段后的输出值，并执行 `x-format.output` |
| `initialValues` | 构造时传入的初始值快照 |
| `valid` / `invalid` | 根据当前可见字段的 `errors` 推导 |
| `submitting` | `submit()` 执行中的状态 |
| `errors` | 所有可见字段错误的扁平集合 |

### 核心方法

| 方法 | 当前行为 |
| --- | --- |
| `createField(path, schema, initialValue?)` | 创建 `Field`，处理 default、input 格式化与 `onFieldInit` 生命周期 |
| `getField(path)` | 取字段实例 |
| `setFieldState(path, setter)` | 用局部 setter 修改字段状态 |
| `setValues(values)` | 批量写值，并在写入前执行 `x-format.input` |
| `setInitialValues(values)` | 只更新初始值快照，不自动重置当前字段 |
| `reset()` | 重置所有字段，并重新跑一遍 reaction runner |
| `validate()` | 校验所有可见字段，返回 `Promise<boolean>` |
| `submit(onSubmit?)` | 先校验，再返回 `onSubmit(form.values)` 或直接返回 `form.values` |
| `subscribe(listener)` | 订阅表单整体版本变化 |
| `setSchema(schema)` | 清空旧字段和 reaction，重建字段树并设置新联动 |
| `getArrayField(path)` | 仅在目标字段为数组字段时返回实例 |
| `removeArrayItem(path, index)` | 调用数组字段的 `remove(index)` |
| `onFieldChange(path, listener)` | 监听某个字段或 `*` 的变化 |
| `onValuesChange(listener)` | 监听 `form.values` 变化 |
| `onError(listener)` | 监听运行期协议错误 |

## Field 实例

`Field` 是 `Form` 创建出来的最小响应式单元。大多数字段行为都集中在这里，包括显示模式、校验、数组行管理。

### 核心属性

| 属性 | 当前行为 |
| --- | --- |
| `path` / `address` | 当前实现中两者相同，都是点路径 |
| `value` | 普通字段直接返回值；数组字段会动态从子字段汇总出对象数组 |
| `display` | `visible` / `hidden` / `none` |
| `pattern` | `editable` / `readOnly` / `disabled` / `readPretty` |
| `component` / `componentProps` | 渲染组件名与组件 props |
| `decorator` / `decoratorProps` | 装饰器名与装饰器 props |
| `dataSource` | 归一化后的选项数组，支持 `enum` 与 `dataSource` |
| `loading` | `computed` reaction 异步执行时会被自动切换 |
| `errors` / `warnings` / `validateStatus` | 校验反馈状态 |
| `isArrayField` / `arrayItems` | 数组字段标记与按行分组的子字段列表 |

### 核心方法

| 方法 | 当前行为 |
| --- | --- |
| `setValue(value)` | 写值并触发字段值变化通知 |
| `setState(partial)` | 批量修改 display、pattern、title、dataSource 等 |
| `validate()` | 依次执行 required、静态 validators、`x-validate` |
| `reset()` | 恢复 initialValue，清空错误和 warning |
| `push(initialValues?)` | 仅数组字段可用，为新行创建子字段 |
| `remove(index)` | 删除指定行，并对后续行做路径重排 |
| `moveUp(index)` / `moveDown(index)` | 当前通过交换两行字段值实现 |
| `subscribe(listener)` | 订阅字段版本变化 |

## RuntimeRuleHandler

`computed` 规则不会直接调用网络或服务端逻辑，而是通过 `FormConfig.handlers` 找到业务层注册的 handler。

```ts
type RuntimeRuleHandler = (context: {
  field: IField
  form: IForm
  values: Record<string, any>
  deps: Record<string, any>
  dependencies: Record<string, any>
  scope: Record<string, any>
  key: string
  rule: SchemaXRule
  value?: any
  kind?: 'x-reaction' | 'x-format' | 'x-validate'
}) => any | Promise<any>
```

常见场景：

- `x-reaction.dataSource` 里异步拉选项。
- `x-format` 里做同步值标准化。
- `x-validate` 里调服务端校验接口。

## FormError

`onError` 接收的是非致命错误，不会自动抛出打断渲染。当前 `scope` 可能包含：

- `reaction`
- `x-reaction`
- `x-format`
- `x-validate`
- `ref-resolve`
- `expression`

适合把表达式不安全、缺失 handler、`$ref` 解析失败等问题上报到日志系统。

## Demo：注册业务 handlers

下面的示例来自 `apps/demo/src/components/schema-renderer.tsx`，也是当前推荐的业务接入方式：

```ts
const form = createForm({
  handlers: {
    fetchCategories: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return [
        { label: '技术', value: 'tech' },
        { label: '设计', value: 'design' },
        { label: '业务', value: 'business' },
      ]
    },
    fetchSubCategories: async ({ deps }) => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return deps.category ? categoryData[deps.category] || [] : []
    },
    normalizeCode: ({ value }) => String(value ?? '').trim().toUpperCase(),
    checkConfirmCode: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return String(value ?? '').trim().toUpperCase() === 'OK'
        ? []
        : [{ message: '确认码必须是 OK', type: 'x-validate' }]
    },
  },
})
```

## Demo：effects 监听值变化

```ts
const form = createForm({
  effects(form) {
    form.onValuesChange((values) => {
      console.log('latest values:', values)
    })

    form.onError((error) => {
      console.warn('[form runtime error]', error)
    })
  },
})
```

## 需要注意的真实实现细节

- `form.values` 会执行 `x-format.output`，如果你想拿未经格式化的内部值，需要自己在业务层保留原始状态。
- `x-format` 的执行路径是同步的，若 handler 返回 Promise，当前实现会报错而不是等待。
- `validateFirst` 目前只有类型，没有真正参与 `validate()` 的短路逻辑。
