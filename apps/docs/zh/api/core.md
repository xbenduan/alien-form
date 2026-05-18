# 核心 API

## `createForm(config?)`

创建 `IForm` 实例。

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { name: '' },
  scope: { upper: (s: string) => s.toUpperCase() },
  services: { fetchUsers: async (params) => [...] },
  effects: (form) => {
    form.registerLifecycle('onFieldValueChange', 'email', (field) => {
      console.log('email changed:', field.value)
    })
  },
})
```

### `FormConfig`

| 属性 | 类型 | 说明 |
|------|------|------|
| `initialValues` | `Record<string, any>` | 初始值 |
| `validateFirst` | `boolean` | 遇到第一个错误即停止 |
| `effects` | `(form: IForm) => void` | 注册生命周期钩子 |
| `scope` | `Record<string, any>` | 自定义表达式作用域变量 |
| `services` | `Record<string, Function>` | 异步数据源服务注册 |
| `transformers` | `Record<string, Function>` | 响应转换器注册 |

## `IForm`

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `fields` | `Map<string, IField>` | 所有注册的字段实例 |
| `values` | `Record<string, any>` | 当前表单值（排除不可见、void、数组子字段） |
| `initialValues` | `Record<string, any>` | 创建时传入的初始值 |
| `valid` | `boolean` | 所有可见字段无错误 |
| `invalid` | `boolean` | `valid` 的反面 |
| `submitting` | `boolean` | `submit()` 执行中 |
| `errors` | `FieldError[]` | 所有可见字段错误汇总 |

### 方法

```ts
form.createField(path, schema, initialValue?): IField
form.getField(path): IField | undefined
form.setFieldState(path, setter): void
form.setValues(values): void
form.setInitialValues(values): void
form.reset(): void
form.validate(): Promise<boolean>
form.submit<T>(onSubmit?): Promise<T>
form.setSchema(schema: IFormSchema): void
form.getArrayField(path): IField | undefined
form.removeArrayItem(arrayPath, index): void
form.subscribe(listener): () => void
form.onFieldChange(path, listener): () => void
form.onValuesChange(listener): () => void
form.registerLifecycle(event, path, handler): () => void
```

## `IField`

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 点分路径 |
| `value` | `any` | 当前值 |
| `display` | `FieldDisplayTypes` | `'visible'` \| `'hidden'` \| `'none'` |
| `pattern` | `FieldPatternTypes` | `'editable'` \| `'readOnly'` \| `'disabled'` \| `'readPretty'` |
| `visible` | `boolean` | `display !== 'none'` |
| `disabled` | `boolean` | `pattern === 'disabled'` |
| `required` | `boolean` | 是否必填 |
| `title` | `string` | 显示标签 |
| `errors` | `FieldError[]` | 验证错误 |
| `component` | `string` | 组件名 |
| `componentProps` | `Record` | 组件属性 |
| `dataSource` | `Array<{label, value}>` | 选项数据 |
| `loading` | `boolean` | 加载状态 |
| `isArrayField` | `boolean` | 是否为数组字段 |

### 方法

```ts
field.setValue(value): void
field.setErrors(errors): void
field.setDataSource(ds): void
field.setLoading(loading): void
field.setDisplay(display): void
field.setPattern(pattern): void
field.setComponent(component, props?): void
field.setState(state): void
field.validate(): Promise<FieldError[]>
field.reset(): void
field.subscribe(listener): () => void

// 数组操作
field.push(initialValues?): void
field.remove(index): void
field.moveUp(index): void
field.moveDown(index): void
```

## React Hooks

```ts
import { useForm, useField, useFormState, useArrayField } from '@formily-bao/core'

const form = useForm()
const field = useField('username')
const { values, valid, submitting, errors } = useFormState()
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')
```

## 生命周期事件

通过 `effects` 中的 `form.registerLifecycle()` 注册：

| 事件 | 触发时机 |
|------|---------|
| `onFieldInit` | 字段创建 |
| `onFieldMount` | 组件挂载 |
| `onFieldUnmount` | 组件卸载 |
| `onFieldValueChange` | 值变化 |
| `onFieldInputValueChange` | 用户输入 |
| `onFieldValidateStart` | 验证开始 |
| `onFieldValidateEnd` | 验证结束 |
| `onFieldValidateFailed` | 验证失败 |
| `onFieldValidateSuccess` | 验证通过 |
