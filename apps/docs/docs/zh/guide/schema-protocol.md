# Schema 协议

AlienForm 的 Schema 不是一个抽象的“表单描述语言”，而是一份**会被核心层直接编译为字段树和运行时规则**的协议。它本质上是三部分的组合：

- 静态结构：字段路径、嵌套关系、数组项结构
- 运行时投影：`component`、`decorator`、`state`、`dataSource`、`validators`
- 动态规则：`x-reaction`、`x-format`、`x-validate`

这篇文档以**当前仓库真实实现**为准，重点说明 Schema 在 AlienForm 里到底会如何被解释、创建和执行。

## 根节点形状

根 Schema 的真实入口只有两个：

- `form.setSchema(schema)`
- `<SchemaField schema={schema} />`

根节点类型固定为 `object`：

```ts
interface IFormSchema {
  type: 'object'
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

当前实现并没有 `Schema` 类，运行时消费的就是普通 JSON 对象。

## Schema 到底做了什么

当你把 Schema 交给表单时，核心层会做下面几件事：

1. 清空旧字段和旧联动。
2. 缓存根级 `definitions`。
3. 按 `order` 对当前层 `properties` 排序。
4. 递归创建字段树。
5. 在字段树创建完成后，统一安装 `x-reaction`。

也就是说，Schema 不是“渲染时临时读一下”的描述，而是会被编译成完整的运行时模型。

## 支持的基础类型

当前仓库支持的字段类型有：

- `string`
- `number`
- `boolean`
- `object`
- `array`
- `void`
- `date`
- `datetime`

其中真正决定节点行为的，不只是 `type`，还包括它有没有 `component`、有没有 `properties`、`items` 是不是对象等附加信息。

## 标准字段子集

AlienForm 支持 JSON Schema 的一个实用子集：

- `type`
- `title`
- `description`
- `default`
- `required`
- `minimum`
- `maximum`
- `minLength`
- `maxLength`
- `pattern`
- `format`
- `properties`
- `items`
- `definitions`（仅根级）
- `$ref`

这些标准字段并不会原封不动保留到运行时，而是会被翻译成 Field 的状态、校验器和结构信息。

## 运行时扩展字段

相比普通 JSON Schema，AlienForm 额外扩展了以下字段：

- `state`
- `validators`
- `component`
- `props`
- `decorator`
- `decoratorProps`
- `dataSource`
- `dataSourcePolicy`
- `x-reaction`
- `x-format`
- `x-validate`
- `content`
- `data`

其中最重要的三类是：

- **渲染层投影**：`component`、`decorator`、`props`、`decoratorProps`
- **字段状态**：`state`、`dataSource`、`validators`
- **动态协议**：`x-reaction`、`x-format`、`x-validate`

## 节点类型的真实语义

### object 节点

`object` 有两种模式。

第一种：**有 `component` 的 object**

- 会创建一个真实的字段实例
- 同时继续递归创建子属性
- 适合“自身也是一层容器组件”的对象节点

第二种：**没有 `component` 的 object**

- 只作为路径容器
- 不会创建独立字段实例
- React 层只渲染它的子节点

这意味着 `object` 不一定等于一个可见的 UI 容器，它也可能只是值路径分组。

### void 节点

`void` 是布局节点。

它的核心语义是：

- 用来承载布局组件、分组组件、卡片、分栏等结构
- 自己不向 `form.values` 贡献值
- 仍然可以带 `component`、`props`、`title`、`description`、`content`
- 仍然可以继续递归渲染子属性

因此 `void` 更像“UI 容器协议”，而不是“值节点协议”。

### array 节点

`array` 也有两种典型模式。

第一种：`items` 是带 `properties` 的对象

- 会创建数组字段
- 会为每一行继续创建子字段
- 适合表格、卡片列表、明细行等场景

第二种：`items` 不是对象结构

- 只创建简单数组字段
- 不会自动展开为复杂行字段树

数组行内真正被编辑的是诸如 `users.0.name` 这样的子字段，而不是一个大对象整体。

## 字段是如何创建出来的

创建字段时，核心层会优先取值：

1. `initialValues`
2. `schema.default`

拿到初始值之后，会先执行 `x-format.input`，再创建 `Field` 实例。

随后，`Field` 会从 Schema 中投影出以下运行时信息：

- `title`
- `description`
- `display`
- `pattern`
- `component`
- `componentProps`
- `decorator`
- `decoratorProps`
- `dataSource`
- `validators`
- `x-validate`

因此，Schema 里的很多字段最终会变成 `Field` 身上的运行时状态，而不是保留为“原始配置”。

## state 的真实含义

`state` 不是一个独立的小系统，它只是字段初始状态的声明入口。

显示态入口是：

- `visible`
- `hidden`
- `none`

交互态入口是：

- `editable`
- `readOnly`
- `disabled`
- `readPretty`

也就是说：

- `display` 负责显示态：`visible | hidden | none`
- `pattern` 负责交互态：`editable | readOnly | disabled | readPretty`

## component / decorator 的真实角色

Schema 里的 `component` 和 `decorator` 都不是直接渲染 JSX，而是**注册键名**。

例如：

```json
{
  "component": "Input",
  "decorator": "FormItem"
}
```

运行时真正做的是：

- 在 `components` 注册表里查找 `Input`
- 在 `decorators` 注册表里查找 `FormItem`
- 用当前字段的运行时状态生成 props 后再渲染

因此，Schema 描述的是“组件身份”，不是组件实现本身。

## dataSource

`dataSource` 是当前 schema 协议里唯一的选项源入口。

在进入运行时前，数据源会被标准化：

- 字符串 / 数字会转成 `{ label, value }`
- `{ key, title }` 也会被转换为标准结构
- 最终统一成选项数组

这也是为什么 Select 类组件总能拿到统一结构的数据源。

## dataSourcePolicy 的作用

当联动或异步加载导致 `dataSource` 变化时，字段当前值可能已经不在新选项里了。当前实现用 `dataSourcePolicy` 控制如何处理这种情况。

支持的策略有：

- `preserve`
- `clear`
- `filter`
- `first`

适用场景：

- 子分类跟随主分类刷新
- 多选项随接口返回变化
- 切换选项源后决定是否保留旧值

## definitions 与 $ref

当前仓库对 `$ref` 的支持非常克制。

### 支持范围

只支持：

```json
{ "$ref": "#/definitions/Name" }
```

并且 `definitions` 只能定义在根 `IFormSchema` 上，字段节点内声明不会生效。

不支持：

- 远程引用
- 任意 JSON Pointer
- 非根级路径引用
- 跨文件引用

### 合并规则

`$ref` 展开后，本地节点属性会覆盖引用目标属性。例如：

```json
{
  "$ref": "#/definitions/UserName",
  "title": "申请人姓名"
}
```

这里 `title` 会覆盖定义里的原始标题。

### 为什么 React 层也要展开 $ref

因为渲染分支要根据“展开后的真实类型”判断当前节点是 `void`、`object` 还是普通字段。

如果只在 core 建字段时展开，而 React 渲染仍读取未展开的原始节点，就会出现：

- 布局节点走错渲染分支
- `$ref` 展开的字段无法正常交互

所以当前项目的 React 层也会在渲染前同步展开 `$ref`。

## x-reaction

`x-reaction` 用来做字段属性联动。

当前项目真实支持的写法不是 `target` 风格，而是：

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "contactType": "contactType"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    }
  }
}
```

也就是说：

- key 本身就是目标属性
- `dependencies` 才是依赖声明字段
- 表达式直接写 JS 表达式字符串
- 支持 `static` / `expression` / `match` / `computed`

它适合做：

- 显隐切换
- 标题 / 描述 / props 联动
- `value` 计算
- `dataSource` 异步加载
- `pattern` 切换

## x-format

`x-format` 用来做值转换，而不是 UI 联动。

结构固定为：

```json
{
  "x-format": {
    "input": { ...rule },
    "output": { ...rule }
  }
}
```

### 真实边界

- `input` 只在字段创建和 `form.setValues()` 时执行
- `output` 只在读取 `form.values` 和 `form.submit()` 时执行
- 普通输入时不会自动重跑 `input`
- `x-format` 必须是同步的，不能返回 Promise

它更适合：

- 金额换算
- 枚举映射
- 默认值 / 提交值转换
- 同步标准化处理

## x-validate

`x-validate` 用来做动态校验。

它本身就是一条规则或规则数组：

```json
{
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : '两次输入不一致'"
  }
}
```

### 校验顺序

字段校验时，顺序是：

1. `display === 'none'` 则跳过
2. `required`
3. 静态 `validators`
4. `x-validate`

### 返回值语义

- `undefined` / `null` / `true`：通过
- `false`：失败但无具体消息
- `string`：作为错误消息
- `object` / `array`：会继续归一化为错误列表

### 触发时机

不会在每次输入时自动触发，只会在：

- `field.validate()`
- `form.validate()`
- `form.submit()`

时运行。

## form.values 到底是什么

这是最容易误判的边界之一。

`form.values` 不是所有字段原始值的直接快照，而是：

- 过滤掉 `display === 'none'` 的字段
- 过滤掉 `void` 节点
- 过滤掉数组子字段路径
- 对结果应用 `x-format.output`

之后得到的“提交态值对象”。

这意味着：

- `display: 'none'` 的字段不会出现在 `form.values` 里
- `display: 'hidden'` 的字段仍然保留在 `form.values` 里
- `void` 节点永远不会出现在 `form.values` 里
- 数组子字段不会单独输出，因为数组字段已经聚合了整行值

## 协议的职责边界

Schema 负责的是：

- 字段结构
- 值路径
- 组件注册键
- 初始状态
- 静态校验
- 动态联动
- 值转换
- 动态校验

Schema 不负责的是：

- 远程 Schema 获取
- 组件自动注册
- 网络传输逻辑
- 全局副作用调度
- React 之外的应用层流程编排

如果一个需求本质上不是“字段结构和字段状态派生”，那通常就不应该硬塞进 Schema。

## 如何理解 AlienForm 的 Schema

最准确的理解方式是：

> AlienForm 的 Schema 不是纯声明式 UI 配置，而是一份会被 core 编译成字段模型、状态模型和轻量规则引擎的运行时协议。

掌握这一点之后，很多行为边界就会清晰很多：

- 为什么 `void` 不出现在 `form.values`
- 为什么 `display: 'none'` 会影响值输出和校验
- 为什么 `x-format.input` 不会在每次输入时运行
- 为什么 `$ref` 必须在 core 和 React 两侧都展开
