# 场景驱动的组件架构设计（Scene-Driven Components）

> 目标：一份 Schema 配置一次，在「编辑 / 详情 / 表格 / 筛选」四个场景自动渲染，
> 由组件自身的 **meta 声明**决定「在哪个场景、映射成什么样」，
> 消灭散落在消费端的手写映射表，做到单一事实来源（Single Source of Truth）。
>
> 本项目无历史包袱，本设计为「一步到位」目标态，不含渐进迁移步骤。

---

## 1. 背景与现状诊断

### 1.1 已有地基（保留）

当前体系已具备 meta 驱动多场景的雏形，三块设施健全：

| 设施 | 位置 | 作用 |
|------|------|------|
| 场景枚举 `AdapterScene` | `packages/cms/src/define/adapters.ts` | `recordForm / recordDetail / recordFilter / tableCell / builder` |
| 字段分场景 meta `x-cms` | `packages/cms/src/types/schema.ts` | 按 `table / filter / form / detail / mobile` 分支配置 |
| 场景投影 projection | `packages/cms/src/projection/*` | 把同一 schema 投影成各场景所需形态 |

### 1.2 真正的痛点（本设计要解决的）

「组件 → 场景渲染」这最后一跳目前是**手写硬编码**，集中在
`apps/alien-cms/src/shared/adapters/index.ts`：

```ts
// 痛点 1：filter 场景的降级规则是隐性知识，写死在消费端
export const filterFormComponents = {
  ...buildSceneMap("recordFilter", "component"),
  Textarea: map.Input,   // Textarea 在 filter 里降级成 Input
  Switch: map.Select,    // Switch 在 filter 里变成 Select
};

// 痛点 2：编辑 → 详情 的映射是一张手工大表
export const detailFieldDisplayComponents = {
  Input: map.DisplayText,
  Select: map.DisplayChoice,
  Switch: map.DisplayBoolean,
  DateInput: map.DisplayDate,
  // ... 每加一个组件都要来这里登记
};
```

问题本质：
- **映射关系不在组件身上**，而散落在消费端的手写对象里。
- 新增组件要记得去 4 个地方登记，否则某个场景就「漏渲染」。
- `Switch→Select`、`Textarea→Input` 这类降级是**隐性约定**，没有单一事实来源。

### 1.3 核心结论

> **可行，但不是「字面意义上同一个组件实例承担四种职责」。**
>
> 正确目标是：**同一个「字段语义契约」在四个场景下被解析成不同的渲染策略**。
> 组件用 meta 声明「我在每个场景长什么样」，框架用一个统一 resolver 查表，
> 消费端只问 resolver 要结果。

---

## 2. 设计目标与非目标

### 2.1 目标

1. **声明式**：每个组件在定义处声明四个场景的渲染策略，一处定义、四处生效。
2. **单一事实来源**：删除 `filterFormComponents` / `detailFieldDisplayComponents` /
   `detailFormComponents` 等全部手写映射对象，改由 resolver 自动生成。
3. **mode 分流**：场景差异通过 `mode` 注入组件，而非为每个场景写一个新组件。
4. **可委托**：组件可声明 `renderAs` 把某场景委托给另一个组件（如详情委托给 Display 组件）。
5. **可追溯**：任何字段在任何场景的渲染决策都能被一个函数解释清楚，便于调试。

### 2.2 非目标（明确不做，避免过度抽象）

- **不**追求 100% 同一组件。filter 的 operator 语义、table 的摘要折叠、detail 的富展示
  是真实业务差异，强行合并会产生 if-else 地狱。
- **不**把复杂类型（array-of-object、嵌套 object）塞进统一模型，保留专用摘要逃生口
  （现有 `TableCellRenderer` 的摘要逻辑保留）。

---

## 3. 概念模型

```
            ┌─────────────────────────────────────────────┐
            │  字段 Schema  (CmsFieldSchema + x-cms)        │
            │  - type / component / dataSource / props      │
            │  - x-cms.{form|detail|table|filter}           │
            └───────────────────────┬─────────────────────┘
                                    │  scene = ?
                                    ▼
            ┌─────────────────────────────────────────────┐
            │  SceneResolver                                │
            │  输入: (field, scene)                         │
            │  查: adapter.config.scenes[scene]             │
            │  输出: { Component, mode, props, operator }    │
            └───────────────────────┬─────────────────────┘
                                    │
        ┌───────────────┬───────────┼───────────────┬───────────────┐
        ▼               ▼           ▼               ▼               ▼
   recordForm      recordDetail  tableCell      recordFilter     builder
   mode=edit       mode=readonly mode=cell      mode=filter      (预览)
```

四个场景的本质差异只有三类，全部用 `mode` + `operator` 表达：

| 场景 | 本质差异 | 表达手段 |
|------|---------|---------|
| recordForm (add/edit) | 可写、带校验 | `mode="edit"` |
| recordDetail | 只读、展示友好 | `mode="readonly"`（或 `renderAs` 委托 Display 组件） |
| tableCell | 只读 + 压缩成摘要 | `mode="cell"` |
| recordFilter | 可写 + 语义改变（区间/包含） | `mode="filter"` + `operator` |

---

## 4. 核心类型设计

### 4.1 场景渲染模式

```ts
// packages/cms/src/define/adapters.ts
export type SceneMode = "edit" | "readonly" | "cell" | "filter";

export type AdapterScene =
  | "recordForm"
  | "recordDetail"
  | "recordFilter"
  | "tableCell"
  | "builder";
```

### 4.2 场景变体（SceneVariant）—— 替代原来的 `scenes: string[]`

```ts
export interface SceneVariant {
  /** 该场景下组件以什么模式渲染；默认按场景推导（见 4.5） */
  mode?: SceneMode;
  /** 委托给另一个 adapter key 来渲染该场景（如 detail 委托 DisplayChoice） */
  renderAs?: string;
  /** 该场景下注入组件的默认 props，优先级低于字段 x-cms 配置 */
  props?: Record<string, unknown>;
  /** 仅 recordFilter 场景：该字段的默认操作符 */
  operator?: FilterOperator;
  /** 仅 tableCell 场景：是否压缩成摘要并提供「展开」入口 */
  summary?: boolean;
}

/** scenes 从「数组」升级为「场景能力表」 */
export type SceneMap = Partial<Record<AdapterScene, SceneVariant>>;
```

### 4.3 新的 `defineAdapter` 签名

```ts
export interface AdapterConfig<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  key: string;
  label: string;
  description: string;
  kind: AdapterKind;            // "component" | "decorator" | "display" | "utility"
  scenes: SceneMap;             // ← 关键变更：对象而非数组
  meta?: TMeta;
  params?: AdapterParam[];
}
```

定义示例（对照现状 `Select` adapter）：

```ts
// 编辑/筛选自己渲染；详情/表格委托给 DisplayChoice。全部声明在一处。
export default defineAdapter(Select, {
  key: "Select",
  label: "下拉选择组件",
  description: "下拉选择组件。",
  kind: "component",
  meta: { fieldType: "string" },
  scenes: {
    recordForm:   { mode: "edit" },
    recordFilter: { mode: "filter", operator: "in" },
    recordDetail: { renderAs: "DisplayChoice" },
    tableCell:    { renderAs: "DisplayChoice", summary: true },
    builder:      { mode: "readonly" },
  },
});
```

```ts
// Switch 在 filter 场景降级为 Select —— 从「index.ts 硬编码」变成组件自声明
export default defineAdapter(Switch, {
  key: "Switch",
  /* ... */
  scenes: {
    recordForm:   { mode: "edit" },
    recordFilter: { renderAs: "Select" },     // 原 `Switch: map.Select`
    recordDetail: { renderAs: "DisplayBoolean" },
    tableCell:    { renderAs: "DisplayBoolean", summary: true },
  },
});
```

```ts
// Textarea 在 filter 场景降级为 Input —— 原 `Textarea: map.Input`
export default defineAdapter(Textarea, {
  key: "Textarea",
  /* ... */
  scenes: {
    recordForm:   { mode: "edit" },
    recordFilter: { renderAs: "Input", operator: "contains" },
    recordDetail: { renderAs: "DisplayText" },
    tableCell:    { renderAs: "DisplayText", summary: true },
  },
});
```

### 4.4 统一组件契约（Component Contract）

所有 `kind: "component"` 的 adapter 接收统一 props，内部按 `mode` 切渲染。
这把现有 `ReadonlyArrayCards`（用 `disabled:true` 复用 ArrayCards）的思路标准化：

```ts
export interface SceneComponentProps<TValue = unknown> {
  /** 由 resolver 注入，组件据此切换渲染形态 */
  mode: SceneMode;
  value?: TValue;
  onChange?: (next: TValue) => void;
  /** 合并后的最终 props（见 4.6 优先级） */
  dataSource?: DataSourceItem[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** 字段原始 schema，复杂渲染时使用 */
  field: CmsFieldSchema;
  /** 仅 filter 场景：当前操作符 */
  operator?: FilterOperator;
}
```

组件内部范式：

```tsx
function Select(props: SceneComponentProps) {
  if (props.mode === "readonly" || props.mode === "cell") {
    // 极少数组件会自渲染只读态；多数交给 renderAs 委托给 Display 组件
    return <DisplayChoice {...props} />;
  }
  if (props.mode === "filter" && props.operator === "between") {
    return <RangeSelect {...props} />;
  }
  return <AntSelect mode={...} {...props} />;
}
```

> 设计取舍：`readonly/cell` 优先用 `renderAs` 委托给独立的 Display 组件（关注点分离），
> 只有当只读态与编辑态差异极小时才在组件内用 `mode` 分流。两种手段都被 resolver 支持。

### 4.5 默认 mode 推导

当 `SceneVariant.mode` 未显式声明时，按场景给出默认值，减少样板：

| scene | 默认 mode |
|-------|-----------|
| recordForm | `edit` |
| recordFilter | `filter` |
| recordDetail | `readonly` |
| tableCell | `cell` |
| builder | `readonly` |

### 4.6 props 合并优先级（低 → 高）

```
组件 SceneVariant.props  <  字段 schema.props  <  字段 x-cms[scene].props
```

例：`filter-fields.ts` 现有逻辑 `{ ...field.props, ...x-cms.filter.props }` 即此规则的子集，
统一收敛到 resolver。

---

## 5. SceneResolver —— 框架核心

### 5.1 职责

输入「字段 + 场景」，输出「用哪个组件、什么 mode、什么 props、什么 operator」。
这是替代所有手写映射对象的唯一入口。

```ts
// packages/cms/src/projection/scene-resolver.ts
export interface ResolvedSceneRender {
  Component: AdapterComponent;     // 最终落地的组件
  mode: SceneMode;
  props: Record<string, unknown>;  // 已合并
  operator?: FilterOperator;       // filter 场景
  summary?: boolean;               // tableCell 场景
  /** 调试用：渲染决策来源链路 */
  trace: string[];
}

export function resolveSceneRender(
  field: CmsFieldSchema,
  scene: AdapterScene,
  registry: AdapterRegistry,
): ResolvedSceneRender | undefined;
```

### 5.2 解析算法

```
1. componentKey = field.component（无则按 field.type 推导默认组件）
2. adapter = registry[componentKey]；若该 adapter 未声明 scenes[scene] → 返回 undefined（该场景不渲染）
3. variant = adapter.config.scenes[scene]
4. 若 variant.renderAs 存在：
      target = registry[variant.renderAs]
      Component = target.component        // 委托
      trace.push(`${componentKey} --renderAs--> ${variant.renderAs}`)
   否则：
      Component = adapter.component
5. mode = variant.mode ?? 默认mode(scene)
6. props = merge(variant.props, field.props, field.x-cms[scene].props)
7. operator = field.x-cms.filter.operator ?? variant.operator   (仅 filter)
8. summary = field.x-cms.table?.expandable ?? variant.summary    (仅 tableCell)
9. return { Component, mode, props, operator, summary, trace }
```

> `renderAs` 只做一跳委托（不递归链式），保持可预测性；如需多跳，定义阶段直接指向终点。

### 5.3 生成场景组件表（消费端友好层）

`@alien-form/react` 的 `FormProvider` 需要一张 `Record<key, Component>` 的 components 表。
我们用 resolver 自动生成它，**彻底替代** `buildSceneMap` 与一切手写映射：

```ts
// 替代 recordFormComponents / filterFormComponents / detailFormComponents
export function buildSceneComponents(
  scene: AdapterScene,
  registry: AdapterRegistry,
): Record<string, AdapterComponent> {
  const result: Record<string, AdapterComponent> = {};
  for (const item of registry) {
    const variant = item.config.scenes[scene];
    if (!variant) continue;                  // 该组件不参与此场景
    const mode = variant.mode ?? defaultMode(scene);
    const Target = variant.renderAs
      ? registry.find((x) => x.key === variant.renderAs)!.component
      : item.component;
    // 用一个稳定的包装注入 mode + 场景默认 props
    result[item.key] = withSceneMode(Target, mode, variant.props);
  }
  return result;
}
```

`withSceneMode` 是一个极薄的 HOC：把 `mode` 和默认 props 注入，再把 schema 渲染层
传入的 `value/onChange/...` 透传。它取代了现在 `ReadonlyArrayCards` 那种一次性手写包装。

---

## 6. 消费端改造（目标态）

### 6.1 表单（编辑/详情）—— `SchemaFormShared.tsx`

```ts
// 现状：硬编码二选一
export function getSchemaFormAdapters(mode) {
  return mode === "detail" ? detailFormComponents : recordFormComponents;
}

// 目标：统一走 resolver 生成
const SCENE_OF_MODE = { add: "recordForm", edit: "recordForm", detail: "recordDetail" } as const;
export function getSchemaFormAdapters(mode: SchemaFormMode) {
  return buildSceneComponents(SCENE_OF_MODE[mode], registry);
}
```

`detailFormComponents`、`detailFieldDisplayComponents`、`recordFormComponents`、
`recordFormDecorators` 全部删除，由 `buildSceneComponents("recordDetail"/"recordForm")` 取代。

### 6.2 筛选 —— `RecordFilterBar.tsx`

```ts
// 删除 filterFormComponents（含 Textarea/Switch 硬编码降级）
components={buildSceneComponents("recordFilter", registry)}
```

operator 不再由 `filter-fields.ts` 单独拼装，而是 resolver 输出的一部分，
`projectFilterFields` 调用 resolver 拿 `operator/props/component`，逻辑收敛。

### 6.3 表格 —— `TableCellRenderer.tsx`

```ts
// 简单标量：交给 resolver 选出的 Display 组件（mode="cell"）
const r = resolveSceneRender(column.field, "tableCell", registry);
if (r && !isComplex(column)) return <r.Component {...cellProps} mode="cell" />;

// 复杂类型（array-of-object / 嵌套 object）：保留现有专用摘要逻辑（逃生口）
return buildComplexSummary(column, value, record);
```

`canUseSharedDisplayComponent` 这类「能不能用共享展示组件」的判断被
`resolveSceneRender` 是否返回结果取代。

---

## 7. 复杂类型与逃生口

不是所有东西都该进统一模型。明确保留专用处理：

| 场景 | 复杂类型处理 |
|------|------------|
| tableCell | array-of-object / object → `buildArraySummary` / `buildObjectSummary`（现有逻辑保留），并提供「展开抽屉」入口 |
| recordDetail | 嵌套对象 → `SectionCard`，对象数组 → 只读 `ArrayCards`（`mode="readonly"`） |
| recordFilter | 复杂字段被 `projectFilterFields` 的 `isLeafField` 拆成叶子路径，仅叶子参与筛选 |

判定原则：**resolver 返回 `undefined` ⇒ 落入专用渲染分支。** 这让「统一」和「专用」的边界由
组件 meta 显式决定，而不是消费端临时 if 判断。

---

## 8. 可追溯性（Devtools）

抽象层加深后必须保证可调试。`ResolvedSceneRender.trace` 记录决策链，例如：

```
field "isActive" @ recordFilter
  → component "Switch"
  → scenes.recordFilter.renderAs = "Select"
  → mode "filter", operator "eq"
  → props { dataSource: [...] }  (来源: x-cms.filter.props)
```

开发模式下 resolver 可把 trace 挂到渲染元素的 `data-scene-trace` 属性，
配合一个简单的 inspector 浮层即可回答「这个字段为什么在 filter 里长这样」。

---

## 9. 目标态文件清单

| 文件 | 动作 |
|------|------|
| `packages/cms/src/define/adapters.ts` | `scenes` 改为 `SceneMap`；新增 `SceneVariant` / `SceneMode`；`createAdapterCatalog` 透出 `scenes` 对象 |
| `packages/cms/src/projection/scene-resolver.ts` | **新增** `resolveSceneRender` + `buildSceneComponents` + `defaultMode` |
| `packages/cms/src/projection/filter-fields.ts` | operator/props/component 改为调用 resolver |
| `packages/cms/src/index.ts` | 导出 resolver 相关类型与函数 |
| `apps/.../shared/adapters/*.tsx` | 每个 component adapter 的 `scenes` 改为对象声明（含 `renderAs` 降级） |
| `apps/.../shared/adapters/index.ts` | **删除** `buildSceneMap` / `filterFormComponents` / `detailFieldDisplayComponents` / `detailFormComponents` / `recordFormComponents`；改为 re-export `buildSceneComponents` |
| `apps/.../shared/components/SchemaFormShared.tsx` | `getSchemaFormAdapters` 走 `buildSceneComponents` |
| `apps/.../domains/record/components/RecordFilterBar.tsx` | components 走 `buildSceneComponents("recordFilter")` |
| `apps/.../domains/record/components/TableCellRenderer.tsx` | 简单值走 resolver，复杂值保留专用摘要 |

---

## 10. 收益总结

- **配置一次，四端联动**：Schema 是唯一输入，渲染策略由组件 meta 声明，配置成本与不一致 bug 显著下降。
- **新组件零散落登记**：接入一个组件只需在其定义处写一份 `scenes`，自动在四个场景生效。
- **隐性约定显性化**：`Switch→Select`、`Textarea→Input` 等降级规则从消费端硬编码变成组件自声明。
- **关注点清晰**：编辑/筛选的「可写」与详情/表格的「只读展示」通过 `mode` + `renderAs` 解耦，
  既复用契约又不强行合并实现。
- **可调试**：每个渲染决策都有 trace，抽象不黑盒。
```