# Core API

## createForm

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: {},
  handlers: {
    fetchUsers: async ({ deps }) => [{ label: 'Alice', value: 'alice' }],
  },
})
```

## FormConfig

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `initialValues` | `Record<string, any>` | 初始值 |
| `validateFirst` | `boolean` | 是否遇到首个错误即停止 |
| `effects` | `(form) => void` | 表单副作用注册 |
| `scope` | `Record<string, any>` | 安全表达式可访问的自定义变量 |
| `handlers` | `Record<string, RuntimeRuleHandler>` | `computed` reaction handler 注册表 |

## RuntimeRuleHandler

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
}) => any | Promise<any>
```
