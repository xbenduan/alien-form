# `@alien-form/core` alien-signals 范式化重构计划

## Summary

目标是在**保留当前公开 schema 协议与主要 API 形态**（`createForm`、`setup`、`form.effect`、`x-reaction`、`x-format`、`x-validate`）的前提下，把 `@alien-form/core` 的内部动态运行时从当前偏 `Formily` 的“手动依赖解析 + 触发器注册 + flush 调度 + 结构变更后整体重建”模式，收敛为更符合 `alien-signals` 心智的“**以 signal/effect 为中心的依赖图执行模型**”，并进一步把代码组织风格从“大 class + 大量 private 成员”调整为“**薄公开对象 + functions-first 内核 + ES6 原语驱动的私有状态管理**”。

本次规划接受 breaking change，但 breaking change 主要落在**内部实现与少量非推荐内部约束**，不主动推翻当前公开 schema DSL。核心原则：

* 对外继续推荐 `setup + form.effect`。

* schema 动态能力继续保留，但内部实现要降级为“声明式派生的 effect 安装器”，而不是独立的 runtime 调度系统。

* 数组/结构变化不再依赖全量 `_rebuildReactions()`，改为通过结构版本信号参与依赖收集。

* `core` 继续保持 renderer-agnostic，不引入 React 语义，不回退到事件总线。
* 内部实现尽量 functions 化，公共 class 若保留，只作为薄壳，不再承担大部分状态编排职责。
* 私有实现优先使用 `Symbol`、`Map`、`Set`、必要时 `WeakMap` 来收口内部边界，而不是继续堆积 `_xxx` 成员与隐式约定。

## Current State Analysis

结合当前代码与文档，`packages/core` 已经具备 alien-signals 的公开姿态，但内部仍存在明显的 Formily 式 runtime 痕迹：

### 已经符合 alien-signals 的部分

* `packages/core/src/form/index.ts`

  * 已提供 `form.effect(runner)` 与 `form.effect(selector, listener, options)`。

  * `getField()` 与 `values` 已通过 `_fieldRegistryVersion` / `_version` 解决 setup 早于 schema 的依赖重绑问题。

* `packages/core/src/field/index.ts`

  * 字段状态已全面 signal 化。

  * `Field.value`、`Field.display`、`Field.pattern` 等读取具备天然依赖追踪能力。

* 文档与 README

  * 已把 `setup + effect` 作为推荐入口。

### 当前最偏 Formily 的部分

* `packages/core/src/form/index.ts`

  * 维护 `_reactionValueTriggers`、`_reactionRunners`、`_reactionDisposers`、`_asyncReactionVersions`、`_reactionRunCounts`、`NotificationScheduler` 等一整套手动调度设施。

  * `x-reaction` 通过依赖路径预解析后注册 trigger，而不是直接让 `effect` 在运行时读取依赖。

  * 数组结构变化后依赖 `_rebuildReactions()` 整体拆掉再重装，说明 reaction 不是真正挂在 signal 图上。

* `packages/core/src/runtime/reaction.ts`

  * 目前更像“规则解释器 + 手动依赖解析器 + 指令派发器”的中心 runtime，而不是“围绕 signal effect 的小型执行层”。

* `packages/core/src/field/array-controller.ts`

  * `push/remove/move/setValue` 通过 host `_rebuildReactions()` 修补动态字段联动，说明结构变化没有进入统一依赖模型。

* `packages/core/src/form/notification.ts`

  * 当前承担“reaction trigger -> version commit -> flush”职责，与 signals 自带的批处理思路重复较多。

### 已确认的产品/架构方向

* 保留 `x-reaction / x-format / x-validate`。

* 对外主路径继续是 `setup + form.effect`。

* 未发布项目，可接受 breaking change。

* 目标是“内部重构”，不是“砍掉 schema 动态能力”。

### 当前实现风格上的额外问题

* `packages/core/src/form/index.ts`

  * `Form` 集中了过多状态、缓存、调度器、runtime 安装与错误处理逻辑，类本身过重。
  * 私有状态主要靠 `_xxx` 命名约定维持，封装边界偏弱。

* `packages/core/src/field/index.ts`

  * `Field` 同时承担 signal 状态、数组控制、数据源协调、订阅桥接与 host 通知，内部职责偏杂。

* `packages/core/src/field/array-controller.ts`

  * 数组控制器虽然已被拆出，但仍然是 class 形态，与 `Field` / `Form` 的内部约定较紧。

这意味着本次规划不能只替换 runtime 机制，还需要顺手把实现风格拉回到更现代的 ES6+/signals-native 代码组织方式。

## Proposed Changes

### 1. 以“规则 effect 安装器”替换“手动 reaction 调度器”

#### 目标

把 `x-reaction` 从“字段路径触发 -> 调度 runner -> 应用结果”的模型，改成“**为每条字段规则安装一个 alien-signals effect**，让 effect 自己读取依赖并自动重跑”的模型。

#### 具体文件

* 重点改造 `packages/core/src/form/index.ts`

* 重构 `packages/core/src/runtime/reaction.ts`

* 新增 `packages/core/src/runtime/rule-effect.ts`

#### 做法

* 在 `Form.setSchema()` 完成字段树创建后，不再注册 `_reactionValueTriggers` / `_reactionRunners`。

* 改为遍历 schema 中每个字段的每条 `x-reaction` 规则，为其安装一个 effect disposer。

* 每个 rule effect 的执行流程固定为：

  1. 读取目标 field。
  2. 读取结构版本信号，保证字段后创建/数组行增减后可重新绑定。
  3. 在 effect 内运行“依赖求值函数”，通过 `getField(depPath)?.value`、`field.value`、`form.values` 等真实 signal 读取完成依赖收集。
  4. 执行 rule（`static` / `expression` / `match` / `computed`）。
  5. 将结果应用到当前字段属性。

* 规则 effect 自带 disposer，统一收集到 `Form` 的 effect 清理集合；`destroy()` 与 `setSchema()` 时直接释放。

#### 预期收益

* 依赖收集回到 signals 原生语义，不再需要 `_reactionValueTriggers`。

* “哪个字段变化会触发哪个 reaction”由 effect 读取路径决定，而不是外部注册表决定。

* 代码心智与 `form.effect` 一致，内外一致。

### 2. 建立“结构版本 signal”，替代数组场景下的 `_rebuildReactions()`

#### 目标

让数组行增删、字段树替换、schema 重建等结构变化，能够通过信号驱动 rule effect 自动重新绑定，而不是整体拆装 reaction。

#### 具体文件

* 改造 `packages/core/src/form/index.ts`

* 改造 `packages/core/src/field/array-controller.ts`

* 视实现需要补充 `packages/core/src/types.ts` 中内部 host 类型

#### 做法

* 保留并强化 `_fieldRegistryVersion` 的语义：它不只是 `getField()` 的兜底依赖，也作为 rule effect 的显式依赖源。

* 在以下场景统一推进结构版本：

  * `createField()`

  * `setSchema()` 清空/重建字段树

  * 数组字段 `push/remove/move/setValue/resetRows`

  * 行内字段 rename/delete/create

* 删除 `ArrayFieldController` 中对 host `_rebuildReactions()` 的调用。

* rule effect 在每次执行时先读取一次结构版本，再解析依赖字段路径；这样数组行路径或目标字段存在性变化后，effect 会自动重跑并重新绑定依赖。

#### 预期收益

* 数组项 reaction 不再依赖“变更后整体重装”。

* 结构变化进入统一响应式模型，符合 signals 的“读到什么依赖什么”。

### 3. 简化 `Form` 的通知与版本机制，保留必要的批处理但去掉重复调度层

#### 目标

缩小 `Form` 中“值变更通知系统”的职责，让它只负责聚合 `form.values` / `subscribe()` 这类表单级快照订阅，而不再承担 reaction runtime 调度。

#### 具体文件

* 重点改造 `packages/core/src/form/index.ts`

* 评估保留或简化 `packages/core/src/form/notification.ts`

#### 做法

* 删除或废弃以下成员及相关逻辑：

  * `_reactionValueTriggers`

  * `_reactionRunners`

  * `_reactionDisposers` 中 reaction trigger 相关职责

  * `_reactionRunCounts`

  * `_reactionRunDepth`

  * `_reactionRunnerSeq`

  * `_rebuildReactions()`

  * `_runReactionValueTriggers()`

  * `_runReactionRunner()`

* `NotificationScheduler` 若继续保留，仅负责：

  * 合并 field/value/version 级别的版本推进

  * 避免一次 `setValues()` 中触发多次 `subscribe()` / selector effect 快照更新

* 若重构后发现 scheduler 价值不足，则进一步简化为直接依赖 `startBatch/endBatch + _version`。

#### 预期收益

* `Form` 回到“字段容器 + schema 安装器 + effect 生命周期管理器”的角色。

* 运行时层次更薄，不再与 alien-signals 自身调度机制叠床架屋。

### 4. 重写 runtime 辅助层的职责边界

#### 目标

把 runtime 从“中心化 orchestrator”改成“轻量规则执行工具箱”。

#### 具体文件

* 重构 `packages/core/src/runtime/reaction.ts`

* 可能新增：

  * `packages/core/src/runtime/rule-effect.ts`

  * `packages/core/src/runtime/dependency.ts`

#### 做法

* `reaction.ts` 保留这些能力：

  * 规则执行：`resolveXRuleValue`

  * 同步/异步规则链：`runXRuleListSync` / `runXRuleListAsync`

  * 结果应用：`applyReactionValue`

  * scope 构建：`buildReactionScope` / `buildValueScope`

* 从 `reaction.ts` 拆出“依赖读取函数”：

  * 输入 `dependencies + selfPath + form`

  * 内部通过 `form.getField(resolvedPath)?.value` 读取，利用 signal 自然收集依赖

  * 输出 `{ deps, depsArray }`

* `resolveDependencies()` 不再承担“静态依赖注册”职责，只负责本次 effect 执行时的依赖求值。

#### 预期收益

* runtime 更像解释器 helper，而不是 mini engine。

* `x-reaction` 与 `form.effect` 使用相同的底层哲学：effect 驱动，helper 辅助。

### 5. 收紧 `FieldHost` / `ArrayFieldHost` 内部契约，减少面向 runtime 的历史遗留接口

#### 目标

让 `Field` 与数组控制器只感知“结构变化 / 值变化 / 校验能力”，不再感知“reaction rebuild”这类实现细节。

#### 具体文件

* 改造 `packages/core/src/field/index.ts`

* 改造 `packages/core/src/field/array-controller.ts`

#### 做法

* 从 host 接口中移除或废弃 `_rebuildReactions?`。

* 若需要内部结构通知，新增更语义化的 host 能力，例如：

  * `_notifyFieldStructureChange?()`

  * 或直接复用 form 的 `_bumpFieldRegistryVersion()`

* 保留 `_runXValidate`、`_createFieldTree` 等仍然合理的桥接点。

* 检查 `Field.setState()`、`Field.setValue()` 中 `_notifyValueChange()` 与 `_notifyFieldChange()` 的职责，避免因为新 runtime 安装 effect 后出现重复推进版本或重复 snapshot 更新。

#### 预期收益

* `Field` 更专注“字段状态与校验”。

* 数组控制器更专注“行生命周期与路径维护”。

### 6. 把内部实现改成 functions-first，公开 class 降为薄壳

#### 目标

在不强行修改公开导出名的前提下，把核心逻辑从 `Form` / `Field` class 中拆出去，形成更容易测试、组合和替换的函数模块。

#### 具体文件

* 重点改造 `packages/core/src/form/index.ts`
* 重点改造 `packages/core/src/field/index.ts`
* 新增：
  * `packages/core/src/form/form-internals.ts`
  * `packages/core/src/field/field-internals.ts`
  * `packages/core/src/field/field-state.ts`

#### 做法

* 保留 `export class Form` 与 `export class Field`，避免对外入口突变。
* 但类内部尽量只保留：
  * 公共 getter / method 转发
  * 极少量构造入口
  * 对 symbol 私有状态的访问桥接
* 把真正的实现迁移到函数模块，例如：
  * `createFormInternals(config)`
  * `installSchemaEffects(internals, schema)`
  * `setFormValues(internals, values)`
  * `createFieldState(schema, initialValue)`
  * `applyFieldStatePatch(state, patch)`
* 所有“可纯计算”的逻辑优先改写为纯函数或小型闭包，而不是继续挂在 class private method 上。

#### 预期收益

* 逻辑单元更小，更接近 alien-signals 一贯的组合式风格。
* 单测可以直接命中 helper，不必总经由重量级 class 实例。
* 后续做 plugin / runtime 裁剪时更容易复用。

### 7. 用 `Symbol` + ES6 容器重建内部私有边界

#### 目标

把当前基于 `_privateField` 命名约定的内部状态，收束到更明确的 symbol-keyed 私有实现对象上。

#### 具体文件

* 重点改造 `packages/core/src/form/index.ts`
* 重点改造 `packages/core/src/field/index.ts`
* 新增：
  * `packages/core/src/form/symbols.ts`
  * `packages/core/src/field/symbols.ts`

#### 做法

* 定义模块内 `Symbol()` 常量，例如：
  * `FORM_INTERNALS`
  * `FIELD_INTERNALS`
* 在 `Form` / `Field` 实例上挂载 symbol keyed internals 对象，而不是把几十个 `_xxx` 直接塞进实例。
* internals 内的数据结构统一采用 ES6 容器：
  * 字段注册表、格式缓存、异步版本表继续使用 `Map`
  * disposer、错误监听器、活跃 effect 使用 `Set`
  * 若需要对象实例到内部状态的弱关联，则使用 `WeakMap`
* 对外完全不暴露 symbol key；内部 helper 通过统一 `getFormInternals(form)` / `getFieldInternals(field)` 访问。

#### 预期收益

* 内部边界更硬，避免外部或测试意外依赖 `_xxx` 细节。
* `Form` / `Field` 实例表面更干净，语义更接近“公开协议对象”。
* 与 functions-first 方案天然契合。

### 8. 顺带清理 ES6+ 写法与集合操作风格

#### 目标

把本次重构顺手统一成现代 TS/ES6+ 风格，避免出现“依赖图是新的，代码风格还是旧的”。

#### 具体文件

* `packages/core/src/form/index.ts`
* `packages/core/src/field/index.ts`
* `packages/core/src/field/array-controller.ts`
* `packages/core/src/runtime/*.ts`

#### 做法

* 优先使用：
  * `Map` / `Set` 组合操作
  * `Object.entries` / `Object.fromEntries`
  * `Array.from`、`flatMap`、`at`
  * 小型工厂函数 + 闭包
* 减少：
  * 巨型 class private method 串联
  * 重复的可变中间状态
  * 依赖命名约定的伪私有字段
* 对性能敏感路径保留必要的原地更新，但要把“可变数据结构”和“公开对象”分层。

#### 预期收益

* 代码风格与 alien-signals 生态常见写法更接近。
* 后续维护时更容易做局部替换，不必每次穿透整个 class。

### 9. 保持公开 API 基本稳定，但明确新的内部原则

#### 目标

避免执行中继续把复杂业务导向 schema imperative runtime，同时不破坏当前 demo / docs 主路径。

#### 具体文件

* `packages/core/src/types.ts`

* `README.md`

* `docs/core-signals-api-redesign.md`

* `apps/docs/docs/zh/api/core/form.md`

* `apps/docs/docs/en/api/core/form.md`

#### 做法

* `IForm` / `FormConfig` 公开签名尽量不变。

* 文档强调：

  * `x-reaction` 是字段本地属性派生，不是跨字段命令式动作系统。

  * 复杂业务控制器继续使用 `setup + form.effect`。

  * schema 动态能力内部虽仍存在，但运行方式已经与 signals 依赖图一致。

* 如果内部重构导致某些边缘行为变化（例如数组场景下 reaction 重装时机、重复触发次数、异步 loading 边界），需要在文档的“行为说明/迁移提示”中明确。

#### 预期收益

* 对外心智与实际实现保持一致。

* 避免继续把 `core` 描述成“Formily-like runtime + signals facade”。

### 10. 用测试锁死“signals-native”行为，而不是只测功能结果

#### 目标

验证这次重构不仅结果正确，而且依赖模型与触发模型已经改变。

#### 具体文件

* 重点补充 `packages/core/src/__tests__/core.test.ts`

* 如有必要新增：

  * `packages/core/src/__tests__/reaction-graph.test.ts`

  * `packages/core/src/__tests__/array-reaction.test.ts`

#### 必测场景

* `setup` 早于 `setSchema()` 时，`form.effect` 与 `x-reaction` 都能在字段创建后自动绑定依赖。

* 修改单个依赖字段时，仅相关 reaction effect 重跑，不依赖手动 trigger map。

* 数组 `push/remove/move/setValue/reset` 后，数组项 reaction 自动重新绑定，不调用 `_rebuildReactions()`。

* `Form` / `Field` 对外实例行为保持稳定，但内部 symbol 私有状态不会泄漏为可依赖的 `_xxx` 字段。

* functions-first helper 可被独立测试，至少为规则 effect 安装、依赖读取、字段状态 patch 各补 1 组直接单测。

* `x-reaction` 的 `static / expression / match / computed` 在同步与异步场景下保持现有结果。

* 异步 `computed` 仍只采纳最后一次结果，并能正确维护 loading 状态。

* 循环依赖仍能被检测并上报，但检测策略改为“effect 写回保护 + 执行计数”围绕单轮 flush/批处理实现，不再依赖旧 runner id 体系。

* `form.setValues()`、`field.setState()`、数组批量更新时，`form.effect(selector)` 与 `subscribe()` 的触发次数不回退。

## Assumptions & Decisions

* 保留当前公开 DSL：`x-reaction`、`x-format`、`x-validate` 不删除。

* 保留当前公开 API：`createForm`、`FormConfig.setup`、`form.effect`、`form.values`、`subscribe` 不主动改名。

* breaking change 允许发生在：

  * 内部实现结构

  * 少量边缘触发顺序/次数

  * 非文档化内部 host 接口

* 不把复杂业务控制器继续塞回 schema；本次重构目标是“内部信号化”，不是“继续扩展 schema 能力边界”。

* `core` 不引入 React 语义，不让 renderer 层参与内部联动。
* 公开导出的 `Form` / `Field` 名称可以保留，但实现将允许大幅“空心化”。
* 若 `NotificationScheduler` 在 functions-first 重组后显得多余，可直接删除而不是为了兼容内部结构继续保留。

## Implementation Sequence

1. 先抽 symbol 与 internals 访问层，为 `Form` / `Field` 薄壳化准备基础设施。
2. 重构 runtime helper：拆出规则执行、依赖读取、rule effect 安装逻辑，并优先做函数化。
3. 改造 `Form`：去掉 trigger map / rebuild runtime，把 schema 安装与生命周期管理迁入 internals。
4. 改造 `Field` 与数组控制器：切到函数式状态 patch + 结构版本驱动，移除 `_rebuildReactions()`。
5. 重新评估并简化 `NotificationScheduler`：保留必要批处理，否则删除。
6. 更新测试：先补 functions-first helper 与结构依赖场景，再修正现有回归测试。
7. 更新 README / docs：把架构描述与真实实现对齐，并说明内部风格调整。

## Verification Steps

### 静态验证

* 检查 `packages/core/src/form/index.ts` 中不再存在：

  * `_reactionValueTriggers`

  * `_reactionRunners`

  * `_rebuildReactions`

  * 以路径 trigger 为核心的 reaction 注册逻辑

* 检查 `packages/core/src/field/array-controller.ts` 中不再调用 `_rebuildReactions()`

* 检查 runtime helper 已拆分为“effect 安装 + 规则执行 + 依赖读取”三个清晰层次
* 检查 `Form` / `Field` 的内部大部分状态已迁入 symbol keyed internals，而不是继续堆在实例 `_xxx` 字段上
* 检查新引入的 helper 主要以函数模块存在，而不是新增等量 class

### 测试验证

* 运行 `packages/core` 的 vitest 测试，确保原有核心行为不回退。

* 新增/更新测试覆盖：

  * setup 早注册 + schema 后创建字段

  * 聚合父字段 effect

  * 数组项 reaction 自动重绑

  * 异步 computed 竞态只取最后一次

  * 循环依赖保护

### 行为验证

* 用 `apps/demo/src/components/schema-renderer.tsx` 的 SKU 场景做人工验证，确认：

  * `setup + form.effect` 行为不变

  * specs -> skus 的聚合联动仍稳定

  * 数组项增删后联动不丢失

* 对照 `README.md` 最小示例和 `apps/docs` 中的 `form.effect` 说明，确认文档示例仍成立。

## 交付标准

满足以下条件即可视为本次改造完成：

* `core` 内部动态联动不再依赖手动 trigger map 与全量 reaction rebuild。

* schema 动态规则与 `form.effect` 共用一致的 signals 依赖收集心智。

* 数组结构变化通过结构版本信号稳定驱动依赖重绑。

* `Form` / `Field` 对外仍是稳定协议对象，但内部实现已明显 functions-first、symbol-private、ES6-container-first。

* 现有 demo、README 主示例、核心测试仍成立，且新增测试能证明“范式已切换”。
