# 命令式逻辑

## 场景

你需要执行与字段状态更新没有严格关系的动作，比如在表单发生变化时记录分析数据（Analytics）、显示 Toast 提示，或者触发全局状态变更。

## 反模式 (Anti-Pattern)

**不要**将 React 的 `useEffect` 与 `useFormState` 或 `useField` 结合使用来监听变化，因为这会导致 React 发生过度地重新渲染。

```tsx
// ❌ 错误示范：会导致每次按键时整个组件树重新渲染
const { values } = useFormState()
useEffect(() => {
  console.log('表单值发生了变化', values)
}, [values])
```

## 标准范式

在 `createForm` 内部使用 `effects` 钩子，直接在核心模型上注册生命周期监听器。

```ts
import { createForm, onFieldValueChange, onFormSubmitSuccess } from '@alien-form/core'

const form = createForm({
  effects(form) {
    // 监听特定字段的变化，且不会导致 React 重新渲染
    onFieldValueChange('status', (field) => {
      if (field.value === 'completed') {
        toast.success('状态已标记为完成！')
      }
    })

    // 处理表单提交成功事件
    onFormSubmitSuccess((form) => {
      analytics.track('form_submitted', form.values)
    })
  }
})
```

### 为什么这样做？
- 逻辑运行在 React 的渲染周期之外，保证了最佳性能。
- 事件监听器的作用域被限定在表单实例内，并且会自动被清理。
- 保持了 Schema 的纯粹性和声明式特性，将副作用（Side-effects）移交给了控制器层处理。
