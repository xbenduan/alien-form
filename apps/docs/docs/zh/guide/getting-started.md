# 快速开始

## 安装

```bash
pnpm add @alien-form/react @alien-form/ui
```

## 最小化配置

```tsx
import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import { Input, FormItem } from "@alien-form/ui";

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...rest} />
  ),
};

const decorators = { FormItem };

const schema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Name",
      component: "Input",
      decorator: "FormItem",
      props: {
        placeholder: "Enter a name",
      },
    },
  },
};

export function App() {
  const form = useCreateForm();

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## 运行时流程

1. `useCreateForm()` 在 React 生命周期内创建并持有一个稳定的 `IForm` 实例。
2. `FormProvider` 将表单模型和组件注册表放入 React 上下文中。
3. `SchemaField` 调用 `form.setSchema(schema)` 并渲染字段树。
4. 渲染器将标准化的字段属性传递给每个字段组件。

## 进阶模式

如果页面外部已经持有 form，也可以直接把外部实例传给 `FormProvider`：

```tsx
import { createForm, FormProvider, SchemaField } from "@alien-form/react";

const form = createForm();
```

这种模式适合：

- 页面外部统一管理 form 生命周期
- 在 React 之外复用同一个 form 实例
- 按需配合 `destroyOnUnmount` 让 Provider 接管销毁

## 注意事项

- 原生文本输入框需要一个适配器，因为渲染器传递的是 `onChange(value)`，而 DOM 输入框触发的是事件对象。
- 建议为类似文本的输入框使用 `value ?? ''` 后备值，以避免 React 报受控/非受控组件警告。
- Schema 中使用的组件和包装器标识符（如 `component: 'Input'`）必须与 `components` 和 `decorators` 中注册的键名一致。
- React 项目只需要依赖 `@alien-form/react`；它已经重导出了 `createForm` 和常用 core 类型。
- 内部复杂联动优先放到 `createForm({ setup }) + form.effect(...)`，不要默认写成 React `useEffect` 补丁。
