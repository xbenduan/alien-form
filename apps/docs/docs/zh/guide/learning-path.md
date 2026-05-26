# 如何学习

学习 AlienForm 最重要的不是背 API，而是先建立“逻辑归位”的判断能力。

推荐顺序不是“先写 React，再补规则”，而是：

1. 先理解 headless runtime
2. 再理解 schema 协议
3. 再接入 React
4. 最后再看 patterns

## 1. 先理解运行时模型

在写任何 React 页面之前，先理解 `core` 的几个基本对象：

- **`createForm()`**：它返回的是长期存活的 `IForm` 运行时对象
- **`IField`**：字段实例是局部状态单元，不只是一个输入框
- **架构边界**：阅读 [架构设计](./architecture)，先搞清楚 schema、`setup`、React、UI 各自负责什么

这一步的目标是建立一个前提：表单逻辑首先属于运行时模型，其次才是 React 页面。

## 2. 再学 Schema 协议

AlienForm 是 schema 驱动的，但 schema 只负责描述结构和字段属性派生，不负责承载任意业务流程。

- **标准属性**：`type`、`title`、`description`、`required`、`default`
- **AlienForm 扩展**：`component`、`decorator`、`x-reaction`、`x-format`、`x-validate`
- **重点文档**：先读 [Schema 协议](./schema-protocol)，再读 [x-reaction](./advanced/x-reaction)

这一阶段要重点理解：`x-reaction` 解释的是“当前字段的属性如何被派生”，而不是“去命令式修改别的字段”。

## 3. 再接入 React

当你已经理解 `core` 和 schema 后，再看 React 层会清晰很多。

建议顺序：

- **`useCreateForm`**：默认的 React 接入起点
- **`FormProvider`**：把 form 和组件注册表放进上下文
- **`SchemaField`**：把 schema 应用到 form 并递归渲染字段树
- **自定义组件**：学习如何遵守字段协议去写 UI 适配器

这一步要建立的认知是：React 是绑定层，不是内部规则的主战场。

## 4. 学会逻辑归位

真正写业务时，最关键的是知道逻辑该放哪：

- **字段属性派生**：优先用 [x-reaction](./advanced/x-reaction)
- **内部复杂联动**：优先用 `createForm({ setup }) + form.effect(...)`
- **值格式化**：看 [x-format](./advanced/x-format)
- **动态校验**：看 [x-validate](./advanced/x-validate)
- **数组建模**：看 [数组字段](./array-fields)

如果一段逻辑本质上是在解释字段自己的 `display`、`pattern`、`title`、`dataSource`，它通常属于 schema。

如果一段逻辑是在协调多个字段、做表单内部规则、或需要集中注册/清理 effect，它通常属于 `setup`。

## 5. 最后再看模式文档

这时再读 patterns，才更容易判断它们为什么这么写：

- [编辑态初始化](../patterns/edit-initialization)
- [形态切换](../patterns/mode-switching)
- [权限控制](../patterns/permissions)
- [规格 SKU 矩阵](../patterns/spec-sku-matrix)

## 一句话建议

先学 schema 如何描述字段，再学 `setup` 如何承接内部规则，最后再学 React hooks 如何做外部桥接。
