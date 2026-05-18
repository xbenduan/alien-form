# 教程

逐步构建注册表单。

## 1. 创建表单

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { role: 'developer' },
  scope: {
    isDevRole: (role: string) => role === 'developer',
  },
})
```

`FormConfig` 字段：

- `initialValues` — 初始值
- `validateFirst` — 第一个错误即停止
- `effects` — 生命周期注册回调
- `scope` — `{{expression}}` 中可用的自定义变量
- `services` — 异步数据源函数注册
- `transformers` — 响应转换器注册

## 2. 定义 Schema

```json
{
  "type": "object",
  "properties": {
    "username": {
      "type": "string",
      "title": "用户名",
      "required": true,
      "x-component": "Input",
      "x-decorator": "FormItem",
      "x-validator": [
        { "minLength": 3, "message": "至少 3 个字符" },
        { "pattern": "^[a-zA-Z0-9_]+$", "message": "仅限字母、数字、下划线" }
      ]
    },
    "email": {
      "type": "string",
      "title": "邮箱",
      "required": true,
      "x-component": "Input",
      "x-decorator": "FormItem",
      "x-validator": [{ "format": "email" }]
    },
    "role": {
      "type": "string",
      "title": "角色",
      "x-component": "Select",
      "x-decorator": "FormItem",
      "enum": [
        { "label": "开发者", "value": "developer" },
        { "label": "设计师", "value": "designer" },
        { "label": "管理者", "value": "manager" }
      ]
    },
    "bio": {
      "type": "string",
      "title": "简介",
      "x-component": "Textarea",
      "x-decorator": "FormItem",
      "x-reactions": {
        "dependencies": { "role": "role" },
        "when": "{{$deps.role === 'developer'}}",
        "fulfill": {
          "schema": {
            "x-component-props": { "placeholder": "介绍你的技术栈..." }
          }
        },
        "otherwise": {
          "schema": {
            "x-component-props": { "placeholder": "介绍一下自己..." }
          }
        }
      }
    }
  }
}
```

## 3. 渲染

```tsx
import { FormProvider, SchemaField } from '@formily-bao/react'
import { Input, Select, Textarea, FormItem } from '@formily-bao/ui'

function RegistrationForm() {
  return (
    <FormProvider
      form={form}
      components={{ Input, Select, Textarea }}
      decorators={{ FormItem }}
    >
      <SchemaField schema={schema} />
      <button onClick={handleSubmit}>注册</button>
    </FormProvider>
  )
}
```

`SchemaField` 在首次渲染时调用 `form.setSchema(schema)`，依次：

1. 通过 `_resolveRef()` 解析 `$ref` 引用
2. 按 `x-index` 排序属性
3. 通过 `createField()` 创建 `Field` 实例
4. 为 `x-reactions` 设置响应式 effect
5. 为 `x-async-data-source` 设置异步获取器

## 4. 提交

```tsx
const handleSubmit = async () => {
  try {
    const values = await form.submit()
    console.log('成功:', values)
  } catch (err) {
    console.error('验证错误:', err.messages)
  }
}
```

`form.submit()` 内部逻辑：
1. 调用 `form.validate()` — 并行验证所有可见字段
2. 失败则抛出 `err.messages`
3. 成功则返回 `form.values`
