# React API

`@alien-form/react` 是当前仓库的 React 绑定层，负责把 `Form` / `Field` 模型接进 React Context，并将 Schema 渲染成组件树。

## 导出总览

| 导出 | 类型 | 用途 |
| --- | --- | --- |
| `FormProvider` | 组件 | 注入 `form`、组件映射、装饰器映射 |
| `SchemaField` | 组件 | 根据 schema 渲染整张表单 |
| `useForm()` | hook | 获取当前 `form` |
| `useField(path?)` | hook | 获取字段实例，并自动订阅变化 |
| `useFormState()` | hook | 读取 `values`、`valid`、`invalid`、`submitting`、`errors` |
| `useArrayField(path)` | hook | 数组字段快捷 API |
| `FormContext` / `FieldContext` | context | 给高级自定义组件使用 |
| `ComponentMap` / `DecoratorMap` | 类型 | 组件注册表类型 |

## FormProvider

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema} />
</FormProvider>
```

### Props

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `form` | `IForm` | 必填，来自 `createForm()` |
| `components` | `Record<string, React.ComponentType<any>>` | 可选，字段组件注册表 |
| `decorators` | `Record<string, React.ComponentType<any>>` | 可选，装饰器注册表 |
| `children` | `ReactNode` | 子树 |

当前实现使用 `useMemo()` 缓存 context value，因此当 `form`、`components`、`decorators` 引用变化时，整棵子树会更新。

## SchemaField

`SchemaField` 的职责不是“递归渲染 schema”这么简单，它还承担了 schema 初始化的入口：

1. 在 `useEffect()` 中调用 `form.setSchema(schema)`。
2. 触发 `Form` 清理旧字段、重建新字段、重建 reactions。
3. 根节点按 `order` 排序后，再通过 `SchemaFieldItem` 逐层渲染。

### 当前渲染规则

| schema 形态 | 当前行为 |
| --- | --- |
| `type: 'void'` 且有 `properties` | 视为布局容器，可选渲染 `schema.component` |
| `type: 'object'` 且有 `properties` 但无 `component` | 不创建额外壳层，直接渲染子字段 |
| `type: 'array'` 且 `items.properties` 存在 | 走 `ArrayFieldRenderer` |
| 其他普通字段 | 走 `FieldRenderer` |

## Hooks

### useForm()

必须在 `FormProvider` 内部调用，否则会直接抛错。

```tsx
const form = useForm()
```

### useField(path?)

- 传入 `path` 时，返回指定字段。
- 不传 `path` 时，优先读取当前 `FieldContext` 的父字段路径。
- 当前实现会对找到的字段执行 `field.subscribe()`，因此字段值和状态变化会驱动组件重渲染。
- 若当前没有 `FormProvider`，返回 `null`。

```tsx
const field = useField('contactType')
```

### useFormState()

返回的不是完整 `form`，而是一个适合渲染层消费的快照：

```ts
{
  values,
  valid,
  invalid,
  submitting,
  errors,
}
```

### useArrayField(path)

对数组字段做了轻量封装：

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')
```

它内部本质上仍然是 `useField(path)`，只是把数组方法转成了更直接的返回值。

## 组件注册契约

`FieldRenderer` 会给普通组件传入以下协议 props：

```ts
{
  ...field.componentProps,
  value: field.value,
  onChange: (value) => field.setValue(value),
  disabled: field.disabled,
  readOnly: field.readOnly,
  readPretty: field.readPretty,
  loading: field.loading,
  pattern: field.pattern,
  dataSource?: field.dataSource,
}
```

`Decorator` 会收到：

```ts
{
  ...field.decoratorProps,
  label: field.title,
  required: field.required,
  errors: field.errors,
  warnings: field.warnings,
  description: field.description,
  validateStatus: field.validateStatus,
  pattern: field.pattern,
}
```

## ReadPretty 变体约定

当字段处于 `readPretty` 模式时，`FieldRenderer` 会优先查找以下组件名：

- `${field.component}.ReadPretty`
- `ReadPretty.${field.component}`

如果都找不到，才回退到基础组件。

## Demo：注册组件适配层

下面这段基本就是 `apps/demo/src/components/schema-renderer.tsx` 的核心做法：

```tsx
const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Textarea: ({ value, onChange, ...rest }: any) => (
    <Textarea
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
}

const decorators = {
  FormItem,
}
```

注意两点：

- `Input` / `Textarea` 建议始终写 `value ?? ''`，避免 React controlled/uncontrolled warning。
- `Select`、`Checkbox`、`Switch`、`Rating` 这类组件本身就是值回调，不需要额外拆 DOM event。

## Demo：SchemaField + submit

```tsx
const form = createForm({ handlers })

<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema.schema} />
</FormProvider>
```

当前 demo 的提交逻辑也是直接复用 `form.submit()`：

```tsx
const values = await form.submit()
```

## 需要注意的真实实现细节

- `SchemaField` 每次 `schema` 或 `form` 引用变化都会重新 `setSchema()`，这意味着字段注册表会重建。
- `useField()` 对不存在的字段返回 `null`，自定义组件里要做好兜底。
- `ArrayFieldRenderer` 会同时订阅数组字段本身和整个 `form`，以便新增、删除、排序后及时刷新行内容。
