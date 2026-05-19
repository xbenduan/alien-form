# FormProvider

## 描述

`FormProvider` 是 `@alien-form/react` 的入口组件。它负责将表单模型、字段组件注册表以及包装器注册表注入到 React 的上下文中。

## 签名

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  {children}
</FormProvider>
```

## Props 说明

| 属性名 | 描述 |
| --- | --- |
| `form` | 必填，`IForm` 实例 |
| `components` | 可选，字段组件注册表 |
| `decorators` | 可选，包装器注册表 |
| `children` | 在 Provider 内部渲染的子树 |

## 注意事项

- `useForm()` 强依赖于此 Provider 提供的上下文。
- Schema 渲染器会使用此上下文中的注册表来查找组件。
