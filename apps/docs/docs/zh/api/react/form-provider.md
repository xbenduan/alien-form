# FormProvider

## 描述

`FormProvider` 是 `@alien-form/react` 的上下文入口组件。它负责把 `form` 实例、字段组件注册表和装饰器注册表注入到 React 上下文中，供 `SchemaField` 和各类 hooks 使用。

## 签名

```tsx
<FormProvider
  form={form}
  components={components}
  decorators={decorators}
  destroyOnUnmount={false}
>
  {children}
</FormProvider>
```

## Props 说明

| 属性名 | 描述 |
| --- | --- |
| `form` | 必填，`IForm` 实例 |
| `components` | 可选，字段组件注册表 |
| `decorators` | 可选，装饰器注册表 |
| `destroyOnUnmount` | 可选，默认 `false`；设为 `true` 时在 Provider 卸载时调用 `form.destroy()` |
| `children` | 在 Provider 内部渲染的子树 |

## 默认行为

- `FormProvider` 默认不会销毁外部传入的 form 实例。
- 只有显式传入 `destroyOnUnmount={true}` 时，卸载阶段才会执行 `form.destroy()`。
- 这能避免 React 18 `StrictMode` 下因为二次挂载而误销毁外部 form。

## 典型用法

### 使用外部 form

```tsx
const form = createForm();

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

### 让 Provider 接管外部 form 的销毁

```tsx
const form = createForm();

function Page() {
  return (
    <FormProvider form={form} destroyOnUnmount>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## 注意事项

- `useForm()` 强依赖于此 Provider 提供的上下文。
- Schema 渲染器会使用此上下文中的注册表来查找组件。
- React 项目通常直接从 `@alien-form/react` 导入 `createForm`、`FormProvider` 和相关类型。
- 如果 form 来自 `useCreateForm()`，hook 在卸载时已经会自动 `destroy()`，通常不需要再额外传 `destroyOnUnmount`。
