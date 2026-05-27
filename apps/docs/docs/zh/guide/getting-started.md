# 快速开始

## 安装

```bash
pnpm add @alien-form/react @alien-form/ui
```

## 最小示例

```tsx
import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import { Input, FormItem } from "@alien-form/ui";

const components = { Input };
const decorators = { FormItem };

const schema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "姓名",
      component: "Input",
      decorator: "FormItem",
      required: true,
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

1. `useCreateForm()` 创建并持有稳定的 `IForm` 实例
2. `FormProvider` 注入表单模型和组件注册表
3. `SchemaField` 调用 `form.setSchema(schema)` 并递归渲染字段树
4. 渲染器将字段属性传递给每个注册组件

## 进阶用法

### 外部持有 form

```tsx
import { createForm } from "@alien-form/react";

const form = createForm({ initialValues: { name: "Alice" } });

function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

### 带 setup 的联动

```tsx
const form = createForm({
  initialValues: { country: "cn" },
  handlers: {
    fetchCities: async ({ deps }) => {
      const res = await fetch(`/api/cities?country=${deps.country}`);
      return (await res.json()).map((c) => ({ label: c.name, value: c.code }));
    },
  },
  setup(form) {
    form.effect(
      (f) => f.getField("country")?.value,
      () => { /* 依赖变化时 handler 会自动重新执行 */ }
    );
  },
});
```

## 注意事项

- 文本输入框需要适配器：渲染器传 `onChange(value)`，DOM 触发事件对象
- 使用 `value ?? ''` 避免 React 受控/非受控警告
- schema 中 `component: 'Input'` 必须与 `components` 注册表键名一致
- React 项目直接从 `@alien-form/react` 导入即可，它重导出了 core 类型
- 内部联动优先 `setup + form.effect(...)`，不要默认写 React `useEffect`
