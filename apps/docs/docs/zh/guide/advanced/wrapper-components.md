# 包装组件（Wrapper Components）

包装组件是 AlienForm 中一类特殊的组件：**它自身的 schema 节点类型为 `void`（不产出值），但它能包装出具有值语义的子字段树**。

它不是简单的"布局"——它是返回组件值的容器，是结构的组织者。

## 核心定义

```
void 节点 + component + properties（含值节点）= 包装组件
```

- 自身不参与 `form.values`
- 自身不产生 `value/onChange`
- 但它的子节点可以是 `object`、`array`、`string` 等任何值类型
- 它控制子节点的布局、分组、可见性

## 与普通字段组件的区别

| 维度 | 字段组件 | 包装组件 |
| --- | --- | --- |
| schema type | `string` / `number` / `object` / `array` 等 | `void` |
| 产出值 | 是 | 否（值在子节点上） |
| 接收 value/onChange | 是 | 否 |
| children | 通常无 | 有，递归渲染子字段 |
| 典型用途 | 输入、选择、编辑 | 分组、分栏、卡片、区块 |

## 常见包装组件

| 组件 | 职责 |
| --- | --- |
| `FormSection` | 标题 + 说明 + 卡片容器 |
| `FormGrid` | 栅格多列排版 |
| `FormLayout` | 方向与间距控制 |
| `FormTab` / `FormStep` | 分步/分页容器 |

## Schema 示例

```json
{
  "profile": {
    "type": "void",
    "title": "用户信息",
    "component": "FormSection",
    "props": { "bordered": true },
    "properties": {
      "grid": {
        "type": "void",
        "component": "FormGrid",
        "props": { "columns": 2 },
        "properties": {
          "name": {
            "type": "string",
            "title": "姓名",
            "component": "Input"
          },
          "age": {
            "type": "number",
            "title": "年龄",
            "component": "NumberInput"
          }
        }
      }
    }
  }
}
```

这里 `profile` 和 `grid` 都是包装组件节点：
- 它们自身不出现在 `form.values` 中
- `name` 和 `age` 的值直接挂在路径 `profile.grid.name`、`profile.grid.age` 上（如果 `profile` 和 `grid` 是透明 object 则路径会打平）

> `void` 节点是**路径透明**的：子字段的路径直接继承 void 的父路径前缀，void 自身的 key 不参与路径拼接。例如上面的 `name` 路径就是 `name`，不是 `profile.grid.name`。

## 包装组件接收的 Props

React 渲染层在处理 `void` 节点时传入：

```tsx
interface WrapperComponentProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  // ...schema.props 中的所有属性
}
```

## 包装组件 vs 透明 object

| 情况 | 类型 | 行为 |
| --- | --- | --- |
| `void + component` | 包装组件 | 有可见容器，渲染 children |
| `object + properties`（无 `component`） | 透明结构 | 无容器 UI，仅路径分组 |
| `object + component + properties` | 容器字段 | 有字段实例 + 有可见容器 + 子字段贡献值到该 object |

## 设计原则

1. **包装组件只负责结构，不负责值。** 如果一个组件需要 `value/onChange`，它不应该挂在 `void` 节点上。
2. **不要让包装组件变成超级业务组件。** 即使页面复杂，包装组件也只做容器。业务逻辑应在子字段的 `x-reaction` 和 `x-validate` 中处理。
3. **包装组件可以嵌套。** `FormSection > FormGrid > FormLayout` 这种嵌套是正常的。

## 何时该用包装组件

**用：**
- 分组、分区、卡片
- 多列栅格
- 分步表单的每一步
- 可折叠区块
- 需要标题/说明但不产出值的容器

**不用：**
- 你需要编辑一个值 → 用字段组件
- 你需要编辑一个对象 → 用 `object + component` 容器字段
- 你需要编辑一个数组 → 用 `array + items` 数组字段
