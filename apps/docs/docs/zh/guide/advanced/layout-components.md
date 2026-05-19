# 布局组件

AlienForm 里的布局组件，本质上不是字段输入控件，而是 schema 结构节点的可视化容器。

最常见的布局组件包括：

- `FormLayout`
- `FormGrid`
- `FormSection`

它们通常用于：

- 标题和说明
- 卡片分组
- 分栏
- 间距与排版

## 核心概念

在当前实现里，布局组件最典型的挂载方式是：

- schema 节点类型为 `void`
- 节点拥有 `properties`
- 节点声明 `component`

例如：

```json
{
  "profile": {
    "type": "void",
    "title": "用户信息",
    "component": "FormSection",
    "props": {
      "bordered": true
    },
    "properties": {
      "grid": {
        "type": "void",
        "component": "FormGrid",
        "props": {
          "columns": 2,
          "gap": 4
        },
        "properties": {
          "name": {
            "type": "string",
            "component": "Input",
            "decorator": "FormItem"
          }
        }
      }
    }
  }
}
```

## `void` 节点的真实语义

`void` 节点最重要的特点是：

- 主要承担布局职责
- 自己不应该成为业务值的一部分
- 可以携带 `title`、`description`、`component`、`props`
- 继续递归渲染子节点

React 渲染层会把它当成布局容器处理，而不是普通字段。

## 布局组件收到什么 props

当前 React 渲染层在处理 `void` 节点时，会把这些信息传给布局组件：

- `schema.props`
- `schema.title`
- `schema.description`
- `children`

也就是说，一个布局组件通常应该长成这种接口：

```tsx
interface FormLayoutProps {
  title?: string
  description?: string
  children?: React.ReactNode
}
```

例如 UI 包里的 `FormLayout`，实现位于 `packages/ui/src/components/form-layout.tsx`。

它本质上就是：

- 读取标题和说明
- 控制 `direction` 与 `gap`
- 把子字段渲染在一个容器里

## 布局组件不应该做什么

布局组件不应该：

- 自己维护表单值
- 自己定义 `value/onChange`
- 自己生成子字段
- 自己做业务派生逻辑

换句话说，布局组件是容器，不是业务编辑器。

## `void` 节点与透明 `object` 的区别

这两个点很容易混淆：

### 1. `void + component`

这是最标准的布局节点。

- 有可见容器
- 有标题/说明
- 有自己的组件
- 继续渲染子字段

### 2. `object + properties` 且没有 `component`

这是透明结构节点。

- 没有单独布局组件
- 不会生成独立容器 UI
- 只起路径分组作用
- 直接递归渲染子节点

例如：

```json
{
  "address": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "component": "Input"
      },
      "street": {
        "type": "string",
        "component": "Input"
      }
    }
  }
}
```

这里 `address` 只是路径前缀，不是布局组件。

## 推荐使用场景

适合用布局组件的场景：

- 页面分组
- 卡片区块
- 栅格布局
- 标题与说明承载
- 表单字段之间的结构组织

不适合用布局组件的场景：

- 你要编辑一个真实值
- 你需要 `value/onChange`
- 你想把多字段业务封成一个对象型组件

如果你的目标是编辑真实值，请优先回到字段组件。

## 常见布局组合

项目里最常见的布局组合是：

- `FormSection`：负责区块和说明
- `FormGrid`：负责多列排版
- `FormLayout`：负责方向和基础间距

demo 示例可以参考 `apps/demo/src/schema/02-layout-and-collections.json`。

这是当前仓库里最标准的布局 schema 示例之一。

## 布局组件与自定义组件的边界

如果你做的是：

- 带标题的卡片
- 分组容器
- 带说明的区块
- 一个视觉壳层

那它大概率应该是布局组件。

如果你做的是：

- 输入一个值
- 选择一个值
- 编辑一个数组字段
- 承载行级编辑行为

那它更可能是字段组件或数组组件。

## 在高级场景中的作用

像“规格与 SKU 销售矩阵”这种复杂业务里，布局组件仍然只负责结构层。

例如：

- `specs` 和 `skus` 是真实字段树
- `SkuTable` 是数组字段渲染器
- 上层页面或 schema 中的区块容器，仍然只是布局组件

不要因为界面复杂，就把布局组件升级成超级业务组件。

## 一句话原则

**布局组件只负责结构和容器，不负责业务值。`void` 节点负责承载布局，真实数据仍然应该落在子字段路径上。**
