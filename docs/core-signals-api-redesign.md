# alien-form core Signals API 重构草案

## 背景

`@alien-form/core` 的底层已经建立在 `alien-signals` 之上，但当前对外 API 仍以事件/生命周期订阅为主：

- `effects: (form) => void`
- `form.onFieldChange(path, listener)`
- `form.onValuesChange(listener)`
- `form.onLifecycle(event, path, handler)`

这套 API 更接近 class lifecycle / event bus 思维，而不是 signals 的依赖收集思维。其结果是：

- 业务联动必须围绕“谁触发了事件”来表达，而不是“我依赖什么值”。
- 父字段聚合值与子字段精确路径事件分离，容易出现 `specs[i].values[j].label` 更新但 `onFieldChange("specs")` 不触发的认知落差。
- 生命周期事件过多，用户需要理解 `onFieldValueChange` / `onFieldInputValueChange` / `onValuesChange` 的差异，心智负担偏高。

本项目尚未发布，没有兼容性要求，因此本次重构目标是一步到位删除旧订阅 API，直接切换到 signals 风格的 effect/watch 模型。

## 目标

### 核心目标

- 删除所有 `onXxx` 风格的公开订阅 API。
- 删除以 lifecycle 为中心的业务联动方式。
- 以 `effect/watch/selector` 作为唯一推荐的联动模型。
- 保持现有 schema 驱动能力、校验能力、数组能力、React 绑定能力稳定。

### 非目标

- 不保留兼容层。
- 不做 deprecated 过渡。
- 不把旧 API 包一层转发到新 API。
- 不在第一阶段重写 `x-reaction` DSL 语法。

## 删除范围

### 公开 API 删除

以下 API 直接删除，不保留兼容：

- `FormConfig.effects`
- `IForm.onFieldChange(path, listener)`
- `IForm.onValuesChange(listener)`
- `IForm.onLifecycle(event, path, handler)`
- `FormLifecycleEvent`
- `FormLifecycleHandler`

### 内部实现删除

以下内部模块和逻辑应一并移除：

- `packages/core/src/form/lifecycle.ts`
- `Form` 中 lifecycle registry 相关字段
- `_emitLifecycle(...)`
- `_fieldChangeListeners`
- `_valuesChangeListeners`
- `NotificationScheduler` 中专为 `emitFieldChange` / `emitValuesChange` 服务的事件分发职责

注意：`NotificationScheduler` 不一定整体删除，但它的职责应收缩为“批处理、版本提交、reaction 触发”，不再承担公开订阅事件总线的角色。

## 新 API 设计

## 总体原则

- 公开 API 只暴露 signals 风格能力，不再暴露事件式订阅。
- 用户表达联动时，优先写“依赖哪些值”和“值变化后做什么”，而不是监听某个生命周期名字。
- 精确路径仍然保留在 `getField(path)` 和 `setFieldState(path)` 这一层，但不再作为公开事件路由机制。

## FormConfig

旧：

```ts
interface FormConfig {
  effects?: (form: IForm) => void;
}
```

新：

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

### 说明

- `setup(form)` 用于在表单创建完成后注册副作用、初始化资源、绑定桥接逻辑。
- `setup` 可以返回 disposer，在 `form.destroy()` 时统一清理。
- `setup` 不再承担“订阅事件”的职责，而是直接调用 `form.effect` / `form.watch`。

## IForm 新接口

建议定义如下：

```ts
interface WatchOptions<T> {
  immediate?: boolean;
  equals?: (prev: T, next: T) => boolean;
}

interface WatchContext {
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

  setSchema(schema: IFormSchema): void;

  getArrayField(path: string): IField | undefined;
  removeArrayItem(arrayPath: string, index: number): void;

  effect(runner: (form: IForm) => void): () => void;
  watch<T>(
    selector: (form: IForm) => T,
    listener: (value: T, prevValue: T | undefined, ctx: WatchContext) => void,
    options?: WatchOptions<T>,
  ): () => void;
  watchFieldValue<T = any>(
    path: string,
    listener: (value: T, prevValue: T | undefined, ctx: WatchContext) => void,
    options?: WatchOptions<T>,
  ): () => void;
  watchValues(
    listener: (
      values: Record<string, any>,
      prevValues: Record<string, any> | undefined,
      ctx: WatchContext,
    ) => void,
    options?: WatchOptions<Record<string, any>>,
  ): () => void;

  onError(listener: (error: FormError) => void): () => void;
}
```

## IField 新接口

建议补充：

```ts
interface IField {
  path: string;
  value: any;
  initialValue: any;
  visible: boolean;
  display: FieldDisplayTypes;
  pattern: FieldPatternTypes;
  errors: FieldError[];

  setValue(value: any): void;
  setState(state: Partial<FieldMutableState>): void;
  validate(): Promise<FieldError[]>;
  reset(): void;
  subscribe(listener: () => void): () => void;

  effect(runner: (field: IField) => void): () => void;
  watch<T>(
    selector: (field: IField) => T,
    listener: (value: T, prevValue: T | undefined) => void,
    options?: WatchOptions<T>,
  ): () => void;
}
```

说明：

- `field.subscribe` 可以继续保留为最低层“版本订阅”能力，但不再作为主推荐 API。
- 对用户文档与 demo，应优先展示 `field.effect` / `field.watch`。

## 行为语义

## form.effect

```ts
form.effect((form) => {
  const specs = form.getField("specs")?.value;
  syncSkuMatrix(specs);
});
```

语义：

- 内部直接基于 `alien-signals.effect`。
- effect 函数执行时读到哪些 signal，就订阅哪些 signal。
- 任一依赖变化时重新执行。
- 返回 disposer。

适用场景：

- 派生状态同步
- 本地副作用
- 值联动
- 字段树聚合值监听

不适用场景：

- 需要拿到前后值 diff
- 需要自定义相等比较
- 需要只在值真正变化时触发 listener

## form.watch

```ts
form.watch(
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

语义：

- `selector` 在 effect 中执行。
- 收集 selector 读取到的 signal 依赖。
- 依赖变化时重新计算 selector。
- 如果 `equals(prev, next)` 为 `true`，则不触发 listener。
- `immediate` 控制初始化是否立刻触发 listener。

适用场景：

- 监听聚合值
- 派生值比较
- 避免高频重复执行

## form.watchFieldValue

本质上是：

```ts
form.watch(
  (form) => form.getField(path)?.value,
  listener,
  options,
);
```

保留它的原因：

- 高频场景简单直观
- 方便从旧 `onFieldChange("name")` 迁移
- 文档和 demo 更易读

## form.watchValues

本质上是：

```ts
form.watch((form) => form.values, listener, options);
```

保留它的原因：

- 外部状态桥接、埋点、调试场景常见
- 替代旧 `onValuesChange`

## 销毁与清理

新增：

```ts
form.destroy(): void;
```

职责：

- 清理所有 `setup` 注册的 disposer
- 清理所有 `form.effect/watch` 注册的 disposer
- 清理 reaction 副作用
- 防止 React 严格模式或多次 mount 下产生悬挂 effect

`destroy()` 将成为稳定性要求的一部分，React 层必须在 Provider 卸载时调用。

## 推荐用法

### 旧写法

```ts
createForm({
  effects: (form) => {
    form.onFieldChange("*", (field) => {
      if (field.path === "specs" || field.path.startsWith("specs.")) {
        syncSkuMatrix();
      }
    });
  },
});
```

### 新写法

```ts
createForm({
  setup: (form) => {
    return form.watch(
      (instance) => instance.getField("specs")?.value,
      () => {
        syncSkuMatrix();
      },
      { immediate: true },
    );
  },
});
```

### 更推荐的新写法

```ts
createForm({
  setup: (form) => {
    return form.effect((instance) => {
      const specs = instance.getField("specs")?.value;
      syncSkuMatrix(specs);
    });
  },
});
```

当回调内部存在 `setValues` 时，应显式做幂等保护，避免自触发循环。

## 内部实现建议

## 1. 把订阅能力建立在 signals effect 之上

`form.effect` 的最小实现方向：

```ts
effect(() => {
  runner(this);
});
```

`form.watch` 的最小实现方向：

```ts
let initialized = false;
let prev: T | undefined;
let stopped = false;

const stop = effect(() => {
  if (stopped) return;
  const next = selector(this);
  const same = initialized && equals(prev as T, next);
  if (!same) {
    const oldValue = prev;
    prev = next;
    if (initialized || immediate) {
      listener(next, oldValue, { form: this, stop: dispose });
    }
  }
  initialized = true;
});

const dispose = () => {
  stopped = true;
  stop();
};
```

注意：

- 需要处理 listener 内 stop 自身的场景。
- 需要避免第一次执行顺序导致 `dispose` 尚未初始化的问题。
- 需要定义默认 `equals`，建议使用 `Object.is`。

## 2. 缩减 NotificationScheduler 角色

保留：

- batch 控制
- reaction trigger path 去重
- version 提交

删除：

- `emitFieldChange`
- `emitValuesChange`

这样调度器只负责保证内部运行顺序，不再承担对外事件广播。

## 3. 删除 lifecycle registry

`form/lifecycle.ts` 整体删除。

理由：

- 对外不再暴露 lifecycle 订阅
- 内部也不再依赖该模型驱动业务联动

校验阶段如果后续仍需暴露边界事件，应通过更明确的状态信号实现，例如：

- `field.validating`
- `field.validateStatus`
- `form.submitting`

而不是继续扩展 `onFieldValidateStart` 这类事件名。

## 4. 强化 destroy 语义

`Form` 内部需要维护统一的 disposer 列表：

- `setup` disposer
- `form.effect/watch` disposer
- runtime reaction disposer

在以下场景都必须正确清理：

- React 组件卸载
- `setSchema()` 触发重建
- 严格模式双 mount
- 测试中的重复 create/destroy

## 5. 区分“版本订阅”和“业务副作用”

当前：

- `form.subscribe()` / `field.subscribe()` 本质是版本订阅

建议：

- `subscribe()` 保留为内部或低层 API
- 文档主路径不再推荐 `subscribe()`
- 业务层全部迁移到 `effect/watch`

## 测试策略

这是本次重构的硬门槛，不能妥协。

## 1. 先补新 API 测试，再删旧 API 测试

执行顺序必须是：

1. 为 `form.effect`、`form.watch`、`form.watchFieldValue`、`form.watchValues`、`form.destroy` 补齐测试
2. 确认新测试覆盖旧能力
3. 删除旧 `onXxx` 相关测试
4. 替换 demo 和 docs

禁止先删旧测试再补新测试。

## 2. 必测用例矩阵

### form.effect

- 创建后立即执行一次
- 依赖字段变化时重新执行
- 非依赖字段变化时不执行
- 数组子项变化时，监听父聚合值的 effect 能触发
- disposer 调用后不再执行

### form.watch

- `immediate: true` 时首次触发
- `immediate: false` 时首次不触发
- 依赖变化且值不同才触发
- 自定义 `equals` 生效
- listener 可拿到 `prevValue`
- listener 内调用 `stop()` 能正确停止

### watchFieldValue

- 标量字段变更可触发
- 对象字段聚合值变更可触发
- 数组子字段变化可驱动父字段聚合值监听

### watchValues

- `setValues` 后触发
- 单字段 `setValue` 后触发
- 数组操作 `push/remove/move` 后触发
- 返回值为当前输出值而非原始内部值

### destroy

- destroy 后 effect/watch 全部停止
- destroy 后重复调用安全
- React 严格模式下无重复残留副作用

### React 集成

- `FormProvider` 卸载时调用 `form.destroy()`
- 重新 mount 不遗留旧副作用
- 现有 binding 测试全部通过

## 3. 回归重点

以下回归点必须单独加测试，不可只靠人工验证：

- SKU 矩阵：`specs.0.values.0.label` 变化可驱动 `skus` 重算
- 数组行增删改后，watch 依赖集合正确更新
- async handler / x-reaction 不因 effect 重构导致重复执行或泄漏
- submit / validate / reset 主流程不受影响

## 4. 最低验收标准

- `packages/core` 全量测试通过
- `packages/react` 全量测试通过
- demo 中 SKU 场景手工验证通过
- docs 示例代码与真实 API 一致
- 全仓库不再出现 `onFieldChange` / `onValuesChange` / `onLifecycle` / `effects:` 字样

## 执行顺序

建议严格按以下顺序实施：

1. 设计并落地新类型定义
2. 实现 `form.effect/watch/watchFieldValue/watchValues/destroy`
3. 为新 API 补测试
4. React 层接入 `destroy`
5. 将 demo 的 SKU 场景改成 `watchFieldValue` 或 `effect`
6. 删除旧 API 与相关内部实现
7. 替换 core/react 文档
8. 全量测试与手工回归

## 风险与决策

## 风险 1：effect 自触发循环

场景：

- effect 内读取 `specs`
- 又在回调里 `setValues({ skus })`

处理：

- 业务层维持幂等判断
- `watch` 推荐配合 `equals`
- 文档明确“写副作用时必须保证输出收敛”

## 风险 2：动态数组依赖丢失

场景：

- 监听 `specs` 时先读到 1 行
- 后续新增第 2 行，effect 是否能自动订阅新子项

处理：

- 依赖收集必须包含数组行数信号
- 现有数组字段的 `value` 聚合逻辑已经具备这个基础，应以测试锁死

## 风险 3：React 严格模式重复 setup

场景：

- 表单实例被重复创建或组件双执行

处理：

- 统一依赖 `destroy`
- 所有 `setup` 和 `watch/effect` disposer 必须可重入清理

## 风险 4：schema reaction 与 signals 副作用叠加

场景：

- 用户同时使用 `x-reaction` 和 `form.watch`

处理：

- 明确职责：
  - `x-reaction` 负责 schema 内声明式联动
  - `form.watch/effect` 负责代码侧副作用
- 通过测试保证两者可共存

## 最终建议

本次重构建议直接采纳以下原则：

- 删除所有旧 `onXxx` 公开 API
- 删除 lifecycle 公开模型
- 用 `setup + form.effect/watch` 替代 `effects + onXxx`
- 保留 `subscribe()` 作为低层版本订阅能力，但不再作为推荐联动 API
- 把稳定性工作重点放在：
  - `destroy`
  - 动态数组依赖
  - React 严格模式
  - 副作用去重与幂等

如果执行得当，这次重构会让 `alien-form/core` 的公开心智从“事件型表单内核”切到“signals 驱动的表单内核”，这比继续在 `onLifecycle` 上打补丁更干净，也更符合项目长期方向。
