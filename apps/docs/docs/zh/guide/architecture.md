# 架构设计

AlienForm 的架构重点是"每类逻辑该落在哪一层"。

## 三层结构

### Core（`@alien-form/core`）

framework-agnostic headless runtime：

- `createForm()` → `IForm`
- 字段树创建与维护
- `x-reaction` / `x-format` / `x-validate` 执行
- `form.effect(...)` 响应式规则
- 校验、提交、数组字段

不感知 React，不持有组件实例。

### React（`@alien-form/react`）

绑定层，不承载内部业务规则：

- `useCreateForm` / `useForm`
- `FormProvider` — 注入 form + 组件注册表
- `SchemaField` — 应用 schema 并渲染字段树
- `useFieldState` / `useFormEffect` / `useFormWatch` 等 hooks

### UI（`@alien-form/ui`）

默认组件实现，可整体替换：

- 字段组件：`Input` / `Select` / `Switch` …
- 布局组件：`FormGrid` / `FormSection` / `FormLayout`
- 数组组件：`ArrayCards` / `ArrayTable`

## 逻辑应该放哪

### schema

- 字段结构、标题、组件、装饰器
- 基于依赖值的属性派生（`x-reaction`）
- 值格式化（`x-format`）
- 动态校验（`x-validate`）

### `createForm({ setup })`

- 表单内部复杂联动
- 多字段协调
- 需要注册/清理的 effect

```ts
createForm({
  setup(form) {
    form.effect(
      (f) => f.getField("country")?.value,
      (country) => {
        // 联动逻辑
      }
    );
  }
});
```

### React 层

- 页面级参数、路由
- 外部状态同步
- 提交按钮等视图交互

## 为什么这样分

- core 可脱离 UI 单独测试
- React 不成为模型层的一部分
- UI 可替换，不影响协议
- `setup` 挂在响应式图上，比 React `useEffect` 补丁更稳定
