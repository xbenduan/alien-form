# Alien Form Runtime 重构 Plan

## 背景

当前运行时把所有 schema field 都建模为带 `value` 的响应式字段，这导致 `object`、`array`、`void` 等结构/布局节点也被误当作值节点。随着 `x-reaction`、数组行、动态依赖和 schema 响应式能力增加，这个模型会持续引入语义歧义、错误响应式和不必要的兼容补丁。

项目尚未发布，因此本次不做最小修补，而是一次性把运行时重构到更符合第一性原理的架构。

## 核心目标

将表单模型从：

> 所有 field 都拥有 `value`，schema/reaction 规则靠 `static | expression | match | computed` switch 解释。

重构为：

> schema 是静态蓝图；field runtime 是响应式节点；只有 value field 拥有 own value；object/array 是结构节点；void 是布局节点；`form.values()` 是 projection；`x-reaction` / `x-effect` 是统一执行模型。

## 设计原则

1. schema 是创建 form 时的静态蓝图，不是响应式对象。
2. 响应式状态属于 runtime field node。
3. own value 只属于 primitive field：`string`、`number`、`boolean`。
4. object/array 没有 own value，但参与 projection。
5. void 完全无值语义。
6. dependency 是 selector，不是 field.value。
7. `x-reaction` 声明式，`x-effect` 命令式。

## Runtime 类型模型

将统一的 `FieldAtoms` 改为 discriminated union：

```ts
type FieldNode = PrimitiveFieldNode | ObjectFieldNode | ArrayFieldNode | VoidFieldNode
```

所有节点共享 runtime meta：`display`、`disabled`、`required`、`errors`、`title`、`description`、`component`、`componentProps`、`decorator`、`decoratorProps`、`dataSource`、`loading`、`dispose`、`validate`、`reset`。

只有 primitive 节点有：

```ts
value: Signal<any>
setValue(value: any): void
```

object/void 节点有 `children`，array 节点有 `rows/push/remove/move/setRows`。

## Array Row Identity

引入稳定 `RowNode`：

```ts
interface RowNode {
  id: string
  index: number
  path: string
  parent: ArrayFieldNode
  children: Map<string, FieldNode>
}
```

内部 identity 使用稳定 `row.id`，外部 path 继续暴露 index path，例如 `items.0.name`。move row 时不销毁 row node，只改变 rows 顺序、index 和 public path。

## Values Projection

`form.values()` 不再遍历所有 `field.value()`，而是做结构投影：

```ts
primitive -> node.value()
object -> project children
array -> rows.map(row => project row.children)
void -> undefined
```

`display === "none"` 的节点不参与 projection。object-with-component 也不产生 own value。

## x-reaction

`x-reaction.value` 只允许用于 primitive field。

array 结构变化使用专属 target：

```ts
"x-reaction": {
  rows: "@createRows"
}
```

所有节点都可支持 UI/runtime meta reaction：`display`、`disabled`、`required`、`title`、`description`、`props`、`decoratorProps`、`component`、`decorator`、`dataSource`。

## Dependency Selector

依赖不再等于 `field.value()`，而是 selector：

- primitive path：`price`、`goods.price`。
- fixed index array path：`items.0.name`。
- row-relative selector：`$row.name`。
- collection selector：`items[].name`。
- object/array path 默认返回 descriptor，不隐式返回完整 projection。

## x-xxx 规则系统

删除用户态 rule switch：`static`、`expression`、`match`、`computed`。

统一成三种输入：

```ts
// literal
display: "hidden"
required: true
props: { placeholder: "请输入" }

// expression
display: "{{ mode === 'advanced' ? 'visible' : 'none' }}"
value: "{{ price * count }}"

// handler
required: "@isRequired"
rows: "@createRows"
```

TS 场景支持函数：

```ts
required: (ctx, form) => ctx.get("price") > 0
```

## x-effect

新增 schema-level 命令式副作用入口，用于替代 `setup`：

```ts
"x-effect": "@formEffect"
"x-effect": ["@syncRows", "@loadOptions"]
```

生命周期绑定当前 schema node；node 创建时安装，dispose 时清理；array row 内 effect 绑定 row 生命周期。

## 删除 setup

删除 `createForm({ setup })`。新的 API：

```ts
createForm({
  schema,
  initialValues,
  handlers,
  scope,
  onError
})
```

## React 层调整

React renderer 按 `field.kind` 注入 props：

- primitive：传 `value/onChange`。
- array：传 `rows/rowNodes/rowFields/onAdd/onRemove/onMove`。
- object：传 children/fields/path，不传 value。
- void：纯 layout。

## Error Policy

非法 reaction target 开发期 warning，并进入 `onError`。handler 不存在、expression 错误、async 错误均进入 `onError`，不中断整个 form。

## 实现顺序

1. 更新 `types.ts`。
2. 重写 core field builder。
3. 实现 projection。
4. 实现 runtime ctx。
5. 实现 expression/handler compiler。
6. 实现 reaction installer。
7. 实现 x-effect installer。
8. 重构 array operations。
9. 重构 React renderer。
10. 更新 demo 和测试。
11. 跑类型检查和构建。

## 最终结论

本次重构的核心不是修补 schema value 响应式问题，而是统一运行时模型：

> Field own value 与 form projected value 分离；container/layout 不再伪装成 value field；reaction 从 rule switch 变成 literal/expression/handler；setup 被 schema-level x-effect 取代。
