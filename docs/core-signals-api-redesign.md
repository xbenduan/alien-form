# alien-form core Signals API 最终方案

## 背景

`@alien-form/core` 的底层已经建立在 `alien-signals` 之上，因此公开联动模型应表达“读取哪些响应式值”，而不是表达“订阅哪个事件”。旧的事件/生命周期式 API 会让父级聚合字段和子字段精确事件产生割裂，例如规格值 label 更新后，父级 `specs` 聚合值已经变化，但父路径事件不一定符合用户直觉。

本项目尚未发布，没有兼容层要求。本次重构直接收敛为 signals 风格 API，并删除旧事件/生命周期订阅入口。

## 最终目标

- 公开联动 API 统一为 `setup(form)` 与 `form.effect(...)`。
- `form.effect` 对齐 `alien-signals` 的依赖追踪语义，并额外提供 selector/listener 重载。
- 删除事件式字段变更、表单值变更、字段生命周期订阅入口。
- 删除 `FormConfig.effects`，只保留 `setup` 作为副作用注册入口。
- React 层默认不销毁外部传入的 form，显式 `destroyOnUnmount` 时才调用 `form.destroy()`。

## FormConfig

```ts
interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  setup?: (form: IForm) => void | (() => void);
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}
```

`setup(form)` 用于注册副作用、桥接外部资源或初始化业务控制器。它可以返回 disposer，该 disposer 会在 `form.destroy()` 时执行。

## IForm

```ts
interface EffectOptions<T> {
  immediate?: boolean;
  equals?: (prev: T, next: T) => boolean;
}

interface EffectContext {
  form: IForm;
  stop: () => void;
}

interface IForm {
  fields: Map<string, IField>;
  values: Record<string, any>;
  initialValues: Record<string, any>;
  valid: boolean;
  invalid: boolean;
  submitting: boolean;
  errors: FieldError[];

  createField(path: string, schema: IFieldSchema, initialValue?: any): IField;
  getField(path: string): IField | undefined;
  setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;
  validate(): Promise<boolean>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  subscribe(listener: () => void): () => void;

  setSchema(schema: IFormSchema): void;
  getArrayField(path: string): IField | undefined;
  removeArrayItem(arrayPath: string, index: number): void;

  effect(runner: (form: IForm, ctx: EffectContext) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: IForm) => T,
    listener: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
    options?: EffectOptions<T>,
  ): () => void;

  onError(listener: (error: FormError) => void): () => void;
}
```

## Effect 语义

### Runner 形态

```ts
form.effect((form) => {
  const specs = form.getField("specs")?.value;
  syncSkuMatrix(specs);
});
```

- 内部直接使用 `alien-signals.effect`。
- runner 执行期间读取到的 signal 会自动成为依赖。
- 任一依赖变化时重新执行 runner。
- runner 可以返回 disposer。
- 返回值是停止当前 effect 的函数。

### Selector 形态

```ts
form.effect(
  (form) => form.getField("specs")?.value,
  (specs, prevSpecs) => {
    syncSkuMatrix(specs, prevSpecs);
  },
  {
    immediate: true,
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  },
);
```

- selector 在 `alien-signals.effect` 内执行，并自动收集依赖。
- 初始化阶段默认只记录当前值，不触发 listener。
- `immediate: true` 会在初始化时立即触发 listener。
- `equals(prev, next)` 用于跳过等价值变更。
- listener 会收到当前值、上一次值和 `EffectContext`。
- `ctx.stop()` 可在 listener 内停止当前 effect。

## 字段注册表依赖

`setup` 通常在 schema 渲染前执行，因此 selector 可能先读到不存在的字段。为保证此场景稳定：

- `form.getField(path)` 会读取字段注册表版本信号。
- `form.values` 会读取字段注册表版本信号与值版本信号。
- `setSchema()`、`createField()` 等字段结构变化会推进字段注册表版本。

这样，`setup` 中注册的 selector effect 即使初次得到 `undefined`，也会在 schema 创建字段后重新收集依赖。

## React Provider 策略

```tsx
<FormProvider form={form} destroyOnUnmount>
  <SchemaField schema={schema} />
</FormProvider>
```

- `FormProvider` 默认不销毁外部传入的 form。
- `destroyOnUnmount` 默认为 `false`。
- 只有显式设置 `destroyOnUnmount` 时，卸载才调用 `form.destroy()`。
- 该策略避免 React StrictMode 开发态 effect cleanup/replay 提前销毁外部 form。

## SKU 推荐写法

```ts
createForm({
  setup: (form) => {
    const syncing = { current: false };

    return form.effect(
      (instance) => instance.getField("specs")?.value,
      () => {
        if (syncing.current) return;
        syncing.current = true;
        try {
          syncSkuMatrix(form);
        } finally {
          syncing.current = false;
        }
      },
      {
        immediate: true,
        equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
      },
    );
  },
});
```

复杂派生逻辑仍应保持幂等，尤其是 listener 内部会写回表单值时，需要显式防止自触发循环。

## 测试要求

- selector effect 能追踪聚合父字段值，例如 `specs`。
- selector effect 能在 `setup` 早于 `setSchema()` 的场景下重新绑定字段依赖。
- `immediate`、`equals`、`ctx.stop()` 行为稳定。
- `form.destroy()` 会清理 `setup` disposer 与 effect disposer。
- React StrictMode 下，默认 Provider 卸载流程不会销毁外部 form。
- `destroyOnUnmount` 显式开启时，Provider 卸载会调用 `form.destroy()`。

## 迁移原则

- 简单字段派生优先使用 schema 的 `x-reaction`。
- 复杂控制器逻辑使用 `setup + form.effect`。
- React 组件内的 UI 局部订阅仍可使用 React hooks，但不要把业务派生逻辑拆散到渲染副作用里。
- `subscribe` 保留为底层版本订阅能力，不作为业务联动推荐入口。
