# 快速开始

本页只覆盖当前仓库里已经实现并公开导出的能力：`@alien-form/core`、`@alien-form/react`、`@alien-form/ui`。

## 安装

```bash
pnpm add @alien-form/core @alien-form/react @alien-form/ui
```

## 最小可运行示例

`FieldRenderer` 传给组件的是统一协议：`value`、`onChange`、`disabled`、`readOnly`、`readPretty`、`loading`、`pattern`。但像 `Input`、`Textarea` 这种原生输入组件接收的是 DOM 事件，因此你通常需要做一层适配。

```tsx
import { createForm } from '@alien-form/core'
import { FormProvider, SchemaField } from '@alien-form/react'
import { Button, Input, Select, FormItem } from '@alien-form/ui'

const form = createForm({
  initialValues: { role: 'developer' },
})

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
}

const decorators = { FormItem }

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: '用户名',
      required: true,
      component: 'Input',
      decorator: 'FormItem',
      validators: [{ minLength: 3, message: '至少 3 个字符' }],
      props: { placeholder: '请输入用户名' },
    },
    role: {
      type: 'string',
      title: '角色',
      component: 'Select',
      decorator: 'FormItem',
      dataSource: [
        { label: '开发', value: 'developer' },
        { label: '设计', value: 'designer' },
      ],
    },
  },
}

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
      <Button onClick={() => form.submit(console.log)}>提交</Button>
    </FormProvider>
  )
}
```

## 运行链路

1. `createForm()` 创建 `Form` 实例，并在构造时执行 `effects`、注册 `handlers` 与 `onError`。
2. `FormProvider` 通过 React Context 暴露 `form`、`components`、`decorators`。
3. `SchemaField` 在 `useEffect` 中调用 `form.setSchema(schema)`，重建字段注册表并初始化联动。
4. `FieldRenderer` 和 `ArrayFieldRenderer` 从字段实例读取状态，再把统一协议 props 传给 UI 组件。
5. `form.submit()` 先 `validate()`，校验通过后返回 `form.values`，并在输出前执行 `x-format.output`。

## 当前包职责

| 包名 | 当前职责 |
| --- | --- |
| `@alien-form/core` | `Form`、`Field`、Schema 协议、表达式、校验、数组操作 |
| `@alien-form/react` | `FormProvider`、`SchemaField`、`useForm`、`useField`、`useFormState`、`useArrayField` |
| `@alien-form/ui` | `Input`、`Select`、`Checkbox`、`ArrayCards`、`FormGrid`、`FormSection` 等默认组件 |

## 从哪里继续看

- 如果你先想看模型层：读 [Core API](../api/core)
- 如果你先想看渲染层：读 [React API](../api/react)
- 如果你先想看协议字段：读 [Schema API](../api/schema)
- 如果你先想看组件注册：读 [Components API](../api/components)
