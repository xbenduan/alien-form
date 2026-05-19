# Form

## 描述

`Form` 是 `@alien-form/core` 中最顶层的运行时模型。它拥有字段注册表、Schema 设置、表单值、提交状态、校验入口、数组字段操作和订阅机制。

通常你不会直接 `new Form()`，而是通过 `createForm(options)` 创建。

```ts
import { createForm } from '@alien-form/core'

const form = createForm({
  initialValues: {
    username: 'alien'
  }
})
```

## createForm

### 签名

```ts
function createForm(config?: FormConfig): IForm
```

`createForm` 返回一个 `IForm` 实例。返回值不是普通数据对象，而是一个可持续读写的表单模型。

### 最小示例

```ts
import { createForm } from '@alien-form/core'

const form = createForm()

form.setSchema({
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: '用户名',
      component: 'Input',
      required: true
    }
  }
})

form.setValues({ username: 'alien' })

console.log(form.values)
// { username: 'alien' }
```

## createForm 返回的可用项

### 核心属性

| 属性名 | 类型 | 描述 |
| --- | --- | --- |
| `fields` | `Map<string, IField>` | 已注册的字段实例集合，key 是字段路径 |
| `values` | `Record<string, any>` | 输出值；会排除不可见字段、void 字段、数组子字段，并应用 `x-format.output` |
| `initialValues` | `Record<string, any>` | 初始值快照，供 `reset()` 使用 |
| `valid` | `boolean` | 当前可见字段是否都没有错误 |
| `invalid` | `boolean` | `valid` 的反义值 |
| `submitting` | `boolean` | `submit()` 执行期间为 `true` |
| `errors` | `FieldError[]` | 所有可见字段的扁平化错误列表 |

### 字段创建与访问

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `createField` | `(path: string, schema: IFieldSchema, initialValue?: any) => IField` | 手动创建字段，一般由 `setSchema()` 内部调用 |
| `getField` | `(path: string) => IField \| undefined` | 根据路径读取字段实例 |
| `setFieldState` | `(path: string, setter: (state: Partial<FieldMutableState>) => void) => void` | 以回调方式修改字段状态 |

### 值操作

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `setValues` | `(values: Record<string, any>) => void` | 将值批量写入已有字段；会应用 `x-format.input` |
| `setInitialValues` | `(values: Record<string, any>) => void` | 更新初始值基线；不会自动改写当前字段值 |
| `reset` | `() => void` | 将字段恢复到初始值，并重新运行 reaction |

### 校验与提交

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `validate` | `() => Promise<boolean>` | 校验所有可见字段，全部通过返回 `true` |
| `submit` | `<T = any>(onSubmit?: (values: Record<string, any>) => T \| Promise<T>) => Promise<T>` | 先校验，再调用提交回调；未传回调时返回 `form.values` |

### Schema 操作

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `setSchema` | `(schema: IFormSchema) => void` | 根据 schema 重建字段树、格式化规则和 reaction |

### 数组字段操作

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `getArrayField` | `(path: string) => IField \| undefined` | 获取数组字段；非数组字段返回 `undefined` |
| `removeArrayItem` | `(arrayPath: string, index: number) => void` | 删除数组字段指定行 |

数组字段本身还提供 `push()`、`remove()`、`moveUp()`、`moveDown()`，详见 [Field](./field)。

### 订阅与副作用

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `subscribe` | `(listener: () => void) => () => void` | 订阅表单级更新，返回取消订阅函数 |
| `onFieldChange` | `(path: string, listener: (field: IField) => void) => () => void` | 订阅字段状态变化，支持 `'*'` 通配 |
| `onValuesChange` | `(listener: (values: Record<string, any>) => void) => () => void` | 订阅输出值变化 |
| `onError` | `(listener: (error: FormError) => void) => () => void` | 订阅非致命运行时错误 |

## effects 里可以调用什么

`effects` 接收到的就是 `createForm()` 返回的同一个 `form` 实例，因此理论上可以调用上面列出的所有公开方法。实际使用时，建议把 `effects` 作为“订阅和生命周期注册”的地方，而不是在里面写复杂业务流程。

```ts
const form = createForm({
  effects(form) {
    const disposeValue = form.onValuesChange((values) => {
      console.log('values changed', values)
    })

    const disposeField = form.onFieldChange('username', (field) => {
      console.log('username changed', field.value)
    })

    const disposeError = form.onError((error) => {
      console.warn(error.scope, error.path, error.message)
    })
  }
})
```

### effects 中推荐使用

| 方法 | 用途 |
| --- | --- |
| `onValuesChange()` | 监听输出值变化，用于埋点、调试、联动外部状态 |
| `onFieldChange()` | 监听某个字段或所有字段状态变化 |
| `onError()` | 统一收集 reaction、format、validate、ref 解析等运行时错误 |
| `getField()` | 在回调中读取字段实例 |
| `setFieldState()` | 在回调中做少量命令式状态修正 |
| `setValues()` | 在初始化后或外部数据到达时批量回填 |
| `validate()` | 在外部流程中主动触发表单校验 |
| `submit()` | 在外部提交动作中复用表单校验和输出值逻辑 |

### effects 中谨慎使用

| 方法 | 原因 |
| --- | --- |
| `setSchema()` | 会清空并重建字段和 reaction；不要在频繁变化的订阅回调里调用 |
| `createField()` | 通常应由 schema 驱动；手动创建字段容易绕开协议结构 |
| `reset()` | 会触发字段值变化和 reaction 重放，避免在无保护的值变化监听里调用 |
| `setValues()` | 可用，但不要在 `onValuesChange()` 中无条件调用，否则可能形成循环 |

## 生命周期注册：registerLifecycle

当前 `Form` 实例上存在 `registerLifecycle(event, path, handler)`，用于注册字段生命周期回调。它已经在运行时实现，但还没有出现在 `IForm` 类型接口里，因此从 TypeScript 视角使用时需要类型扩展或临时断言。

```ts
createForm({
  effects(form) {
    ;(form as any).registerLifecycle?.('onFieldInit', '*', (field, form) => {
      console.log('field init', field.path)
    })
  }
})
```

支持的事件：

| 事件 | 触发时机 |
| --- | --- |
| `onFieldInit` | 字段创建后 |
| `onFieldMount` | 预留事件；当前 core 不主动触发 |
| `onFieldUnmount` | 预留事件；当前 core 不主动触发 |
| `onFieldValueChange` | 字段值变化时 |
| `onFieldInputValueChange` | 当前与 `onFieldValueChange` 同时触发 |
| `onFieldInitialValueChange` | 预留事件；当前 core 不主动触发 |
| `onFieldValidateStart` | 字段开始校验前 |
| `onFieldValidateEnd` | 字段校验结束后 |
| `onFieldValidateFailed` | 字段校验失败时 |
| `onFieldValidateSuccess` | 字段校验成功时 |

`path` 支持精确字段路径，也支持 `'*'` 监听所有字段。

## 输出值边界

`form.values` 不是所有字段原始值的简单拷贝。它会做这些处理：

1. 跳过 `display === 'none'` 的字段。
2. 跳过 `void` 布局节点。
3. 跳过数组子字段路径，由数组字段统一输出数组值。
4. 对字段值应用 `x-format.output`。

如果你在 `computed` handler 里读取 `context.values`，拿到的是当前内部原始值快照；如果读取 `form.values`，拿到的是输出格式化后的值。

## 注意事项

- `setSchema()` 会清除旧字段、旧 reaction、旧格式化规则，然后重建。
- `setInitialValues()` 只更新 reset 基线，不会自动改写当前字段值；编辑态回填通常需要与 `setValues()` 配合使用。
- `setValues()` 只会写入当前已经存在的字段；如果 schema 还没有设置，写入不会产生字段。
- `values` 是派生状态，不要尝试直接修改 `form.values.xxx`。
- `submit()` 校验失败时会抛出异常，并把错误信息数组挂在 `error.messages` 上。
- `onFieldChange('*', listener)` 可以监听所有字段变化，但在大型表单里应注意回调成本。
