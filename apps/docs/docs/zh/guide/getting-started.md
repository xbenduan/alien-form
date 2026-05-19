# 快速开始

## 安装

```bash
pnpm add @alien-form/core @alien-form/react @alien-form/ui
```

## 最小化配置

```tsx
import { createForm } from '@alien-form/core'
import { FormProvider, SchemaField } from '@alien-form/react'
import { Input, FormItem } from '@alien-form/ui'

const form = createForm()

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
}

const decorators = { FormItem }

const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
      component: 'Input',
      decorator: 'FormItem',
      props: {
        placeholder: 'Enter a name',
      },
    },
  },
}

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

## 运行时流程

1. `createForm()` 创建一个 `Form` 实例。
2. `FormProvider` 将表单模型和组件注册表放入 React 上下文中。
3. `SchemaField` 调用 `form.setSchema(schema)` 并渲染字段树。
4. 渲染器将标准化的字段属性传递给每个字段组件。

## 注意事项

- 原生文本输入框需要一个适配器，因为渲染器传递的是 `onChange(value)`，而 DOM 输入框触发的是事件对象。
- 建议为类似文本的输入框使用 `value ?? ''` 后备值，以避免 React 报受控/非受控组件警告。
- Schema 中使用的组件和包装器标识符（如 `component: 'Input'`）必须与 `components` 和 `decorators` 中注册的键名一致。
