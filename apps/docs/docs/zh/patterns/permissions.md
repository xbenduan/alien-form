# 权限与可见性

## 场景

你需要根据当前用户的权限点（Permission Code）来控制特定表单项的渲染与可见性，而不是仅仅依赖表单内部的数据状态。

## 反模式 (Anti-Pattern)

**不要**使用 React 的条件渲染来粗暴地切换整份 Schema，也尽量避免为了常规的权限校验在 Schema 中写满重复的 `x-reaction` 表达式。

```tsx
// ❌ 错误示范：将 React 逻辑与 Schema 结构混合在一起，或维护多份 Schema
<FormProvider form={form}>
  {hasPermission ? <SchemaField schema={schemaWithSecretField} /> : <SchemaField schema={normalSchema} />}
</FormProvider>
```

## 标准范式

直接自定义 `FormItem`（包装器）内部的渲染逻辑。通过使用带有鉴权逻辑的自定义组件包裹标准的 `FormItem`，你可以无缝地拦截并隐藏用户无权查看的组件。

### 1. 创建自定义的鉴权 FormItem

创建一个自定义包装组件，在渲染底层 `FormItem` 之前检查权限。

```tsx
import { FormItem } from '@alien-form/ui'
import { useAuth } from '@/hooks/useAuth' // 假设你有一个全局的鉴权 Hook

export function AuthFormItem(props: any) {
  const auth = useAuth()
  const { code, ...restProps } = props
  
  // 如果该字段配置了权限 code，且当前用户没有该权限，则直接返回 null 不渲染
  if (code && !auth.hasPermission(code)) {
    return null
  }
  
  return <FormItem {...restProps} />
}
```

### 2. 注册并在 Schema 中使用

在 `<FormProvider>` 中注册你自定义的组件，并通过 Schema 中的 `decoratorProps` 将 `code` 参数透传给它。

```tsx
// 1. 注册自定义的 FormItem
const decorators = { FormItem: AuthFormItem }

// 2. 在 Schema 中通过 decoratorProps 注入权限 code
const schema = {
  type: 'object',
  properties: {
    secretData: {
      type: 'string',
      title: '机密数据',
      component: 'Input',
      decorator: 'FormItem',
      decoratorProps: {
        code: 'view_secret_data' // 权限点标识
      }
    }
  }
}

// 3. 渲染表单
export function App() {
  return (
    <FormProvider form={form} decorators={decorators} components={components}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

### 为什么这样做？
- **极致解耦**：权限逻辑与核心业务的 Schema 结构完全解耦。
- **Schema 更纯粹**：你不需要在每一个需要鉴权的字段上编写冗长的 `x-reaction` 可见性规则。
- **融入 React 生态**：鉴权逻辑被集中收敛在 UI 渲染层（包装器组件）中，这使得它能够非常自然地消费 React Context、Hooks 或是类似 Zustand/Redux 的全局状态。
