# `@alien-form/core` signals-native / factory-first 重构计划

## Summary

目标是在 `packages/core` 内把当前“`alien-signals` 驱动、但仍保留较多 Formily/class 风格壳层”的实现，重构成更彻底的 signals-native、functions-first、ES6+ first 内核：

- 对外只保留 `createForm()` 作为公开创建入口，不再把 `Form` / `Field` class 作为正式 API。
- 对内把 `Form`、`Field`、`ArrayFieldController`、`NotificationScheduler` 从 class 迁移为闭包工厂 + 纯函数 helper。
- 继续使用 `Symbol` 承载私有 internals，并扩大 `Map` / `Set` / `Object.defineProperties` / `queueMicrotask` 等 ES6+ 原语的使用比例。
- 保持现有 signals-native 响应式语义不回退：`form.effect(...)`、`x-reaction` effect installer、字段注册表版本重绑、数组结构版本驱动都继续成立。

本次范围只锁定 `packages/core`，不包含 README / docs / react 绑定层同步。

## Current State Analysis

当前 `packages/core` 已经完成了一轮“机制上更偏 signals-native”的改造，但整体仍处于“class 外壳 + internals helper”的过渡态：

- `packages/core/src/form/index.ts`
  - 仍以 `export class Form` 为主载体，公开 API 与 orchestration、schema 构建、effect、notification host 方法混在同一个大文件里。
  - 虽然核心状态已经搬到 `form-internals.ts`，但 `Form` 依然承担了大量 method surface 和内部桥接职责。
- `packages/core/src/field/index.ts`
  - 仍以 `export class Field` 承载对外字段 API。
  - 内部已使用 `field-internals.ts` 和 `field-state.ts`，但 setter、validate、array bridge 仍集中在 class 中。
- `packages/core/src/field/array-controller.ts`
  - 依旧是 `ArrayFieldController` class。
  - 行复制、重命名、row swap 逻辑本质是 runtime helper，适合迁移成闭包控制器或独立纯函数。
- `packages/core/src/form/notification.ts`
  - 仍使用 `NotificationScheduler` class。
  - 当前逻辑已经很小，适合直接函数化成 scheduler state + methods。
- `packages/core/src/index.ts`
  - 仍导出 `Form` 与 `Field` class，这与“公开层纯工厂对象”的目标不一致。
- `packages/core/src/runtime/reaction.ts` 与 `packages/core/src/runtime/rule-effect.ts`
  - 响应式方向已经正确，但 host 仍偏“面向实例对象调方法”，还可以继续收敛为更薄的 runtime capability 接口。

结论：当前实现已经不是旧式 trigger runtime，但还没有走到“公开 API 与内部组织都符合 alien-signals / function-first 心智”的最终形态。

## Assumptions & Decisions

- 决策 1：公开 API 采用纯工厂对象。
  - `createForm(config)` 继续保留。
  - `Form` / `Field` 不再作为正式公开导出。
  - `IForm` / `IField` 继续保留为类型契约。
- 决策 2：breaking change 可接受。
  - `new Form()`、`new Field()` 视为移除。
  - 仅保证 `createForm()` 返回对象的行为与现有测试语义一致。
- 决策 3：本次仅做 `packages/core`。
  - README、docs、`packages/react` 暂不改。
  - 但计划中会标注这些外围依赖将产生文档债。
- 决策 4：保留现有 signals-native 规则模型。
  - 不回退 `form.effect(selector, listener)`。
  - 不恢复事件总线 / trigger runtime。
- 决策 5：优先“函数化组织 + 私有 internals + capability 接口”而不是继续堆积 helper 到 class 上。

## Proposed Changes

### 1. 重建 Form 为纯工厂对象

涉及文件：

- `packages/core/src/form/index.ts`
- 新增 `packages/core/src/form/create-form.ts`
- 新增 `packages/core/src/form/form-methods.ts`
- 复用 `packages/core/src/form/form-internals.ts`
- 复用 `packages/core/src/form/symbols.ts`

改动方案：

- 将当前 `form/index.ts` 中的 `Form` class 拆成三层：
  - `createFormInternals()` 负责 state 容器。
  - `createFormMethods(internals)` 负责返回一组闭包方法。
  - `createForm(config)` 负责组装最终 `IForm` 对象，并用 `Object.defineProperties()` 提供 getter 型属性，如 `values`、`valid`、`errors`、`submitting`。
- `form/index.ts` 退化为导出层，不再定义 `class Form`。
- 原本依赖 `this` 的逻辑，统一改成显式传入 `form` 或 `internals`：
  - `createField`
  - `setFieldState`
  - `setValues`
  - `reset`
  - `validate`
  - `submit`
  - `destroy`
  - `effect`
  - `setSchema`
  - `_runXValidate`
  - `_emitError`
  - `_rawValues`
  - `_valuesSnapshot`
- 内部 host 钩子仍保留，但不挂在 class 原型上，而是作为对象私有 capability 挂到 symbol internals 或 non-enumerable internal methods 上。

为什么这样做：

- 去掉 class 后，`form` 更接近 alien-signals 生态里“响应式对象 + capability methods”的风格。
- 闭包方法天然更适合控制内部访问边界，不需要依赖 `private _xxx` 风格字段。
- `Object.defineProperties` + `Symbol` 比“大 class + 内部成员”更符合这次目标。

### 2. 重建 Field 为纯工厂对象

涉及文件：

- `packages/core/src/field/index.ts`
- 新增 `packages/core/src/field/create-field.ts`
- 新增 `packages/core/src/field/field-methods.ts`
- 复用 `packages/core/src/field/field-internals.ts`
- 复用 `packages/core/src/field/field-state.ts`
- 复用 `packages/core/src/field/symbols.ts`

改动方案：

- 用 `createField(path, schema, initialValue): IField` 取代 `new Field(...)`。
- 字段 API 通过闭包 methods + getter properties 组装：
  - getter：`value`、`display`、`visible`、`pattern`、`errors`、`dataSource`、`arrayItems` 等。
  - method：`setValue`、`setState`、`validate`、`reset`、`push/remove/moveUp/moveDown`、`subscribe`、`effect` 等。
- `_setForm`、`_renamePath` 这类仅供 runtime 使用的能力，不再暴露在公开类型上：
  - 放入 `FIELD_INTERNALS` 对应的内部 capability。
  - 由 `form` / array runtime 通过 internals 访问。
- 保留现有 no-op guard、`shallowEqualObject`、dataSource reconcile 逻辑，但下沉到函数 helper，避免继续堆在“Field 类方法集合”中。

为什么这样做：

- 当前 `Field` 虽然已 symbol 私有化，但整体阅读体验仍是“超大 class 的残留版”。
- 字段对象比表单对象更适合用 `Object.defineProperties()` 暴露派生 getter，因为字段本身就是一组 signal 的视图。

### 3. 把 ArrayFieldController class 改成函数化 runtime

涉及文件：

- `packages/core/src/field/array-controller.ts`
- 可能新增 `packages/core/src/field/array-helpers.ts`

改动方案：

- 移除 `ArrayFieldController` class，改为：
  - `createArrayFieldController(options)` 返回闭包控制器；
  - 或者把 `push/remove/move/swap/collectValue/getItems` 拆为纯函数，由 field internals 持有 minimal controller state。
- 保留现有 host 协议：
  - `fields: Map<string, IField>`
  - `getField()`
  - `createField()`
  - `_createFieldTree?()`
  - `_notifyFieldStructureChange?()`
- 优化细节：
  - 使用 `Map` 遍历快照而不是依赖隐式对象顺序。
  - 将 rename / swap 临时路径逻辑集中为纯 helper。
  - 把“字段删除 / 重命名 / 行 upsert”从控制器实例方法改成显式函数，便于单测和未来替换 row identity 策略。

为什么这样做：

- 数组 runtime 本质是结构变换算法，不适合以 OOP controller 表达。
- 这块是当前最明显的“形式上仍像旧框架”的区域之一。

### 4. 把 NotificationScheduler class 改成 closure scheduler

涉及文件：

- `packages/core/src/form/notification.ts`
- `packages/core/src/form/form-internals.ts`

改动方案：

- 用 `createNotificationScheduler(host)` 取代 `new NotificationScheduler(host)`。
- scheduler 内部状态改为闭包变量：
  - `batchDepth`
  - `pendingFieldChange`
  - `pendingValueChange`
  - `pendingVersionChange`
  - `flushing`
- 对外只返回必要方法和只读状态：
  - `beginBatch`
  - `endBatch`
  - `queueFieldChange`
  - `queueValueChange`
  - `queueVersionChange`
  - `flush`
  - getter: `isBatching` / `isFlushing`

为什么这样做：

- 这部分逻辑已经非常轻量，class 没有额外价值。
- 改成 closure 后，`form-internals.ts` 的创建逻辑会更加统一：所有 runtime 都是工厂产物。

### 5. 收敛 runtime host 为 capability-first 接口

涉及文件：

- `packages/core/src/runtime/reaction.ts`
- `packages/core/src/runtime/rule-effect.ts`
- `packages/core/src/form/create-form.ts` 或 `form-methods.ts`

改动方案：

- 重新定义 rule runtime 依赖的宿主接口，只暴露真正需要的 capability：
  - `getField`
  - `getValuesSnapshot`
  - `getRawValuesSnapshot`
  - `beginFieldLoading`
  - `endFieldLoading`
  - `emitError`
  - `scope`
  - `handlers`
- 减少对“大 form 对象 + any 私有方法”的依赖：
  - 去掉 `typeof (form as any)._rawValues === "function"` 这类分支。
  - 改为在 form internals 或 host factory 中显式注入能力。
- `buildReactionScope` / `resolveDependencies` / `resolveXRuleValue` 继续保留为纯 helper，避免把逻辑搬回 form 工厂。

为什么这样做：

- 现在 rule runtime 虽然是 helper 化的，但仍依赖 form 私有方法名约定。
- capability-first 接口更接近 signals runtime 的“最小依赖面”设计。

### 6. 收敛公开导出面，移除 class 导出

涉及文件：

- `packages/core/src/index.ts`
- `packages/core/src/types.ts`

改动方案：

- `src/index.ts` 只导出：
  - `createForm`
  - 类型导出，如 `IForm`、`IField`、`FormConfig`、schema types 等
- 不再导出：
  - `Form`
  - `Field`
- `types.ts` 保持接口为主，不引入 class 类型。
- 若内部仍需要特定 capability 类型，新增 internal-only type 并留在对应模块，不从入口暴露。

为什么这样做：

- 既然已经明确公开层走纯工厂对象，入口导出必须同步收敛。
- 否则外部仍会被鼓励依赖 class 语义，和目标相冲突。

### 7. 继续强化 ES6+ 原语与私有边界

涉及文件：

- `packages/core/src/form/form-internals.ts`
- `packages/core/src/field/field-internals.ts`
- `packages/core/src/form/symbols.ts`
- `packages/core/src/field/symbols.ts`
- 以及新工厂文件

改动方案：

- 保持所有 runtime state 存于 symbol internals，不回退到命名私有字段。
- 优先使用：
  - `Map` 处理 field registry / installed rule effects / async version maps
  - `Set` 处理 listeners / disposers / formatting guard
  - `Object.entries` / `Object.fromEntries` / `flatMap` / `Array.from`
  - `queueMicrotask`
  - `Object.defineProperty` / `Object.defineProperties`
- 对“runtime only”能力做非枚举挂载，避免污染对外对象可见面。
- 若内部出现跨对象私有引用需求，优先考虑 `WeakMap` 而不是把更多 capability 塞回公开对象。

为什么这样做：

- 这是本次重构的风格基线，不是局部优化项。
- 需要从组织方式上彻底与“Formily-like 大实例”拉开差异。

### 8. 用 core 测试锁定新的 factory-first 行为

涉及文件：

- `packages/core/src/__tests__/core.test.ts`
- `packages/core/src/__tests__/effect.test.ts`
- `packages/core/src/__tests__/effect2.test.ts`
- 新增 `packages/core/src/__tests__/factory.test.ts` 或在 `core.test.ts` 中补充分组

改动方案：

- 保留现有行为测试，确保 signals-native 语义不退化。
- 新增或补强以下断言：
  - `createForm()` 返回的是可工作的 `IForm` 纯对象，而不是依赖 `new Form()`
  - `packages/core/src/index.ts` 不再导出 `Form` / `Field`
  - `setup` 先注册、`setSchema()` 后建字段时，effect 仍会重新绑定
  - `destroy()` 后 effect disposer、schema rule effect disposer 会被清理
  - 数组 `push/remove/move/setValue` 在去 class 化后行为不变
  - reaction async/version guard 仍然成立
- 测试不去验证 symbol 名字本身，但验证：
  - internals 不出现在正常枚举面；
  - 公开对象只暴露约定 API，而不是 class 实例行为。

为什么这样做：

- 这次是内部范式重构，不是简单换写法；需要用测试锁住“行为不变、实现心智变了”。

## Implementation Order

1. 先改 `notification.ts` 与 `array-controller.ts`，把最独立的 class runtime 函数化。
2. 再改 `field` 层：
   - 产出 `createField()`、字段 getter/method assembler；
   - 让 array runtime 与 field internals 对齐。
3. 再改 `form` 层：
   - 产出 `createForm()` 工厂对象；
   - 把 schema、effect、validate、submit、snapshot 等逻辑拆到 helper。
4. 收敛 `reaction.ts` / `rule-effect.ts` 的 host capability 注入方式。
5. 最后修改 `src/index.ts` 入口导出，并补测试。

这个顺序能把风险集中在内部模块边界，避免一开始就同时改公开导出和全部 runtime。

## Risks & Edge Cases

- `form` / `field` 去 class 后，内部 helper 如果仍偷偷依赖 `this`，会出现运行时空引用；实现时必须彻底改成显式参数传递。
- `Object.defineProperties()` 组装 getter 时，如果直接闭包读取 signal 快照，要避免在定义阶段提前求值。
- runtime host 去 `any` 私有方法后，`rule-effect.ts` 与 `reaction.ts` 的快照读取路径必须一次性梳理完整，否则容易重新引入依赖污染。
- 数组 row rename/swap 改写后，最容易破坏的是：
  - `getField(path)` 命中
  - `form.values` 聚合
  - row 删除后旧 path 清理
  - nested array rows
- 入口移除 `Form` / `Field` 导出会造成外围文档与潜在调用方失配；虽然本次不改 docs，但需要在提交说明中显式标注 breaking change。

## Verification Steps

只验证 `packages/core`：

1. 运行 `packages/core` 全量测试：
   - `pnpm vitest run src/__tests__/core.test.ts src/__tests__/effect.test.ts src/__tests__/effect2.test.ts`
2. 如新增 `factory.test.ts`，一并运行：
   - `pnpm vitest run src/__tests__/factory.test.ts`
3. 关注以下高风险行为：
   - `form.effect(...)` 的 selector/listener 重绑
   - `x-reaction` 的 async computed 与 cycle guard
   - `setValues()` 对数组长度替换
   - `destroy()` 清理
   - `createForm()` 出口与 `Form` / `Field` 移除后的 entry 行为
4. 最后对改动过的核心文件做 diagnostics 检查：
   - `packages/core/src/form/*.ts`
   - `packages/core/src/field/*.ts`
   - `packages/core/src/runtime/*.ts`

## Out Of Scope

- `README.md`
- `docs/core-signals-api-redesign.md`
- `apps/docs/**`
- `packages/react/**`

这些内容本次不动，但会因为公开导出面变化而形成后续同步任务。
