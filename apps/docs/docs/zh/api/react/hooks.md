# Hooks

`@alien-form/react` 当前公开的 hooks 分成三类：

- 生命周期与上下文：`useCreateForm`、`useForm`
- 状态读取：`useFormState`、`useField`、`useFieldState`、`useArrayField`
- 副作用与流程辅助：`useFormEffect`、`useFormWatch`、`useFormErrors`、`useFormSubmit`、`useFormValidate`

## useCreateForm

在 React 生命周期内创建并持有一个稳定的 `IForm` 实例，组件卸载时自动调用 `form.destroy()`。

```ts
const form = useCreateForm({
  initialValues: { name: "" },
});
```

适合“当前组件拥有 form 生命周期”的场景。

## useForm

从最近的 `FormProvider` 读取 `IForm` 实例；脱离 Provider 使用时会抛错。

```ts
const form = useForm();
```

## useFormState

返回一个适合直接参与渲染的表单级快照：

```ts
{
  values,
  initialValues,
  valid,
  invalid,
  submitting,
  errors,
}
```

适合渲染提交态、表单错误总览和整体值面板。

## useField

根据路径返回字段实例，并订阅该字段更新；如果不传路径，则会尝试继承最近的 `FieldContext`。

```ts
const nameField = useField("name");
```

当字段不存在时返回 `null`。

## useFieldState

返回字段的渲染快照，适合在自定义组件中直接消费：

```ts
const state = useFieldState("name");
```

返回值包含：

```ts
{
  value,
  display,
  pattern,
  visible,
  hidden,
  disabled,
  readOnly,
  readPretty,
  editable,
  required,
  errors,
  warnings,
  validateStatus,
  title,
  description,
  loading,
  dataSource,
}
```

字段不存在时返回 `null`。

## useArrayField

对数组字段做便捷封装，返回数组项和常用变更方法：

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField("users");
```

- `field`：数组字段实例
- `items`：二维字段数组，每一行对应一组子字段
- `push/remove/moveUp/moveDown`：直接代理到数组字段实例

## useFormEffect

注册一个依赖驱动的副作用，内部通过 `form.effect(runner)` 实现，组件卸载时自动清理。

```ts
useFormEffect((form) => {
  console.log(form.values);
});
```

适合读取多个响应式来源并自动重跑的场景。

## useFormWatch

注册 selector 监听器，内部通过 `form.effect(selector, listener, options?)` 实现。

```ts
useFormWatch(
  (form) => form.getField("country")?.value,
  (country, prevCountry) => {
    console.log(country, prevCountry);
  },
  { immediate: true },
);
```

支持：

- `immediate`：首次注册后立即触发
- `equals(prev, next)`：自定义相等判断

## useFormErrors

订阅非致命运行时错误，例如 reaction、format、validate、`$ref` 解析过程中的结构化错误。

```ts
useFormErrors((error) => {
  console.warn(error.scope, error.path, error.message);
});
```

## useFormSubmit

返回一个带局部提交态的辅助对象：

```ts
const { submit, submitting } = useFormSubmit();
```

```ts
await submit(async (values) => {
  await save(values);
});
```

这里的 `submitting` 是 hook 自己维护的局部状态，用于按钮 loading 很方便。

## useFormValidate

返回校验辅助对象：

```ts
const { validate, validating } = useFormValidate();
```

```ts
const valid = await validate();
```

适合把校验行为挂到外部按钮或分步流程中。

## 选择建议

- 想让组件自己拥有 form 生命周期：用 `useCreateForm`
- 想拿实例：用 `useForm`
- 想渲染整体状态：用 `useFormState`
- 想渲染某个字段：用 `useFieldState`
- 想写表单内部复杂联动：优先 `createForm({ setup }) + form.effect(...)`
- 想在 React 侧做桥接逻辑：用 `useFormEffect` 或 `useFormWatch`
- 想桥接提交和校验按钮：用 `useFormSubmit`、`useFormValidate`
