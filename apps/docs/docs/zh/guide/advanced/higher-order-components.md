# 高阶组件（Higher-Order Components）

高阶组件是 AlienForm 中"返回组件值的组件"——它自身作为容器存在，包装并组织内部的子字段。根据 `type` 的不同，高阶组件有三种形态，分别对应三种场景。

## 三种形态一览

| 形态 | Schema 结构 | 路径行为 | 值行为 | 场景 |
| --- | --- | --- | --- | --- |
| 分组容器 | `void + component + properties` | 路径透明，子字段继承父前缀 | 不贡献值 | 卡片、栅格、分步、折叠面板 |
| 对象容器 | `object + component + properties` | 贡献路径前缀 | 子字段值聚合为该 object | 地址组、联系人信息、嵌套配置 |
| 数组容器 | `array + component + items` | 贡献路径前缀 + 行索引 | 子字段值聚合为数组 | 动态表格、可增删列表、规格矩阵 |

---

## 1. 分组容器：`void + component + properties`

**用途：** 纯 UI 分组，自身不产出任何值，子字段路径不经过它。

```json
{
  "basicCard": {
    "type": "void",
    "title": "基本信息",
    "component": "Card",
    "props": { "bordered": true },
    "properties": {
      "name": { "type": "string", "component": "Input" },
      "age": { "type": "number", "component": "NumberInput" }
    }
  }
}
```

**结果：**
- 子字段路径：`name`、`age`（不是 `basicCard.name`）
- `form.values`：`{ name: "张三", age: 28 }`
- `Card` 组件渲染时收到 `title`、`children`

**特性：**
- 路径透明——`void` 的 key 不参与路径拼接
- 多层 void 嵌套也是透明的
- void 节点自身注册在渲染树中（React 可定位），但不在值树中

**典型组件：** `Card`、`FormSection`、`FormGrid`、`FormTab`、`FormStep`、`Collapse`

---

## 2. 对象容器：`object + component + properties`

**用途：** 包装一组字段为一个结构化对象值。子字段的路径以该节点 key 为前缀，值聚合到该 key 下。

```json
{
  "address": {
    "type": "object",
    "title": "收货地址",
    "component": "AddressGroup",
    "properties": {
      "province": { "type": "string", "component": "Select" },
      "city": { "type": "string", "component": "Select" },
      "detail": { "type": "string", "component": "Input" }
    }
  }
}
```

**结果：**
- 子字段路径：`address.province`、`address.city`、`address.detail`
- `form.values`：`{ address: { province: "浙江", city: "杭州", detail: "..." } }`
- `AddressGroup` 组件渲染时收到 `children`（内部子字段）

**特性：**
- 路径有前缀——`object` 的 key 出现在所有子字段路径中
- 值是嵌套对象
- 组件本身可以做布局，也可以做业务联动（如省市级联）

**典型组件：** `AddressGroup`、`ContactInfo`、`ConfigPanel`、自定义复合输入器

---

## 3. 数组容器：`array + component + items`

**用途：** 包装一个可动态增删行的数组字段。每行展开 `items` 定义的子字段树。

```json
{
  "contacts": {
    "type": "array",
    "title": "联系人列表",
    "component": "ArrayTable",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "component": "Input" },
        "phone": { "type": "string", "component": "Input" }
      }
    }
  }
}
```

**结果：**
- 行子字段路径：`contacts.0.name`、`contacts.0.phone`、`contacts.1.name`...
- `form.values`：`{ contacts: [{ name: "...", phone: "..." }, ...] }`
- `ArrayTable` 组件渲染时可调用 `field.push()`、`field.remove(index)` 等数组方法

**特性：**
- 路径含行索引——`arrayKey.{index}.childKey`
- 支持 `push`/`remove`/`moveUp`/`moveDown` 操作
- items 可以是简单类型（不展开行字段）或 object（展开行字段树）

**典型组件：** `ArrayTable`、`ArrayCards`、`DynamicList`、`SkuMatrix`

---

## 对比表

| 维度 | `void` 分组 | `object` 对象 | `array` 数组 |
| --- | --- | --- | --- |
| 自身有值 | 否 | 是（对象） | 是（数组） |
| 子字段路径含自身 key | 否（透明） | 是 | 是 |
| 子字段 value/onChange | 各自独立 | 各自独立，聚合到 object | 各自独立，聚合到 array |
| 可增删行 | 否 | 否 | 是 |
| 组件接收 field 实例 | 否 | 是 | 是（含数组方法） |

---

## 选择决策树

```
你需要一个可见容器来组织字段吗？
├─ 否 → 不需要高阶组件，直接用字段
├─ 是 → 容器需要在 form.values 中产出值吗？
│  ├─ 否 → void（分组容器）
│  └─ 是 → 值是对象还是数组？
│     ├─ 对象 → object（对象容器）
│     └─ 数组 → array（数组容器）
```

---

## 组件接口规范

### 分组容器（void 节点）

```tsx
interface GroupComponentProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  // + schema.props
}
```

不接收 `field` 实例、不接收 `value`/`onChange`。

### 对象容器（object 节点）

```tsx
interface ObjectComponentProps {
  field: IField;
  children?: React.ReactNode;
  // + schema.props
}
```

接收 `field` 实例（可读取 `field.value` 等状态），但值编辑通过子字段完成。

### 数组容器（array 节点）

```tsx
interface ArrayComponentProps {
  field: IField;
  // + schema.props
}
// field.push(), field.remove(i), field.moveUp(i), field.moveDown(i)
// field.arrayItems → 行字段矩阵
```

接收 `field` 实例，通过数组方法控制行的增删移动。

---

## 设计原则

1. **高阶组件是容器，不是业务编辑器。** 它组织和呈现子字段，不应该自己维护独立的业务状态。
2. **选对 type 就选对了路径和值语义。** void = 透明分组、object = 对象聚合、array = 数组聚合。
3. **不要把简单字段硬套成高阶组件。** 如果只是编辑一个 string/number，直接用字段组件。
