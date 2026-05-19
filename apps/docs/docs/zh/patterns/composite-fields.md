# 复杂组件建模

## 场景

你想做一个“复杂组件”，界面上看起来像一整块卡片，例如：

- 用户信息卡：姓名、年龄、城市
- 地址块：省、市、区、详细地址
- 联系人面板：姓名、电话、邮箱

这时很容易把它设计成一个对象值组件：

```ts
type UserCardValue = {
  name: string;
  age: number;
  city: string;
};

interface UserCardProps {
  value?: UserCardValue;
  onChange?: (value: UserCardValue) => void;
}
```

## 反模式 (Anti-Pattern)

### 不要把多字段编辑折叠成一个对象值组件

```tsx
// ❌ 不推荐：把 3 个字段硬塞进一个 value/onChange 对象协议
function UserCard({ value, onChange }: UserCardProps) {
  return (
    <>
      <input
        value={value?.name ?? ""}
        onChange={(e) => onChange?.({ ...value, name: e.target.value } as UserCardValue)}
      />
      <input
        value={value?.age ?? 0}
        onChange={(e) => onChange?.({ ...value, age: Number(e.target.value) } as UserCardValue)}
      />
      <input
        value={value?.city ?? ""}
        onChange={(e) => onChange?.({ ...value, city: e.target.value } as UserCardValue)}
      />
    </>
  );
}
```

这种设计的问题是：

- schema 无法单独描述 `name`、`age`、`city` 的校验与联动
- 错误状态只能挂在整个对象组件上，粒度太粗
- `x-reaction`、`x-validate`、`required` 等能力没法自然落到子字段
- 任何一个子值变化，都会把整个对象重新组装并回写
- 渲染器看到的只是一个大字段，失去了 Formily/Schema 的字段树优势

## 标准范式

**视觉上可以复杂，数据上不要伪装成单字段。**

推荐方式是：

1. 用 schema 布局节点描述容器
2. 用基础字段描述每个可编辑值
3. 如果需要卡片、分栏、标题，就用 `FormSection`、`FormGrid`、`FormLayout` 这类布局组件

## 推荐写法

### 1. schema 负责字段拆分

```json
{
  "type": "object",
  "properties": {
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
              "title": "姓名",
              "component": "Input",
              "decorator": "FormItem",
              "required": true
            },
            "age": {
              "type": "number",
              "title": "年龄",
              "component": "Input",
              "decorator": "FormItem",
              "props": {
                "type": "number"
              }
            },
            "city": {
              "type": "string",
              "title": "城市",
              "component": "Input",
              "decorator": "FormItem"
            }
          }
        }
      }
    }
  }
}
```

这里真正被编辑的是：

- `name`
- `age`
- `city`

而不是某个 `profileValue` 对象字段。

### 2. 布局组件只负责视觉结构

像 `FormSection`、`FormGrid` 这类组件应该只承担：

- 标题
- 分组
- 分栏
- 卡片容器
- 间距与排版

它们不应该自己拥有整块业务数据，也不应该自己定义一个对象型 `value/onChange` 协议。

## 为什么这是推荐范式

- 每个子字段都有独立路径，便于校验、联动、提交和错误展示
- schema 可以天然表达 `required`、`x-reaction`、`x-validate`
- React 渲染层能直接复用现有的字段渲染机制
- 页面结构复杂时，仍然保持“布局归布局，字段归字段”
- 未来要增加一个字段时，只是加一个 schema 节点，而不是重写整个超级组件协议

## 如果真的想做一个“复杂视觉组件”

也应该优先做“布局组件”，而不是“对象字段组件”。

例如你可以做：

```tsx
function ProfileCard(props: { title?: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4 space-y-4">
      {props.title && <h3 className="text-base font-semibold">{props.title}</h3>}
      {props.children}
    </section>
  );
}
```

然后在 schema 里把它当成 `void` 布局组件来承载子字段，而不是让它直接消费：

```ts
value: {
  (name, age, city);
}
onChange: (next) => {};
```

## 什么时候对象值组件才合理

只有当这块值在业务上真的是**不可拆分的单原子值**时，才适合用单组件承载。例如：

- 一个日期区间组件，输出 `[start, end]`
- 一个经纬度选择器，输出 `{ lng, lat }`
- 一个富文本编辑器，输出整段 HTML / JSON 文档

判断标准不是“UI 看起来复杂”，而是：

- 它在 schema 里需不需要单独校验子字段
- 它在联动里需不需要单独响应子字段
- 它在提交数据里是不是天然就是一个整体

如果答案是“子字段其实都需要独立管理”，那就不要做对象值组件。

## 一句话原则

**复杂 UI 可以做成布局组件，复杂数据不要伪装成单字段组件。能拆成字段树，就不要塞进一个 `value(object) + onChange(object)` 协议里。**
