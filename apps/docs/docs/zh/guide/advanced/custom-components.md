# 自定义组件

AlienForm 的自定义组件体系分为三个层次，每层有明确的协议和职责边界：

| 层次 | 注册位置 | 核心职责 | Schema 引用 |
| --- | --- | --- | --- |
| 普通组件 | `components` | 编辑单个字段值 | `"component": "Input"` |
| 高阶组件 | `components` | 组织和包装子字段（3 种场景） | `"component": "Card"` + `properties/items` |
| FormItem 组件 | `decorators` | 包装字段的外层容器（标签、校验、描述） | `"decorator": "FormItem"` |

## 注册入口

所有组件在 `FormProvider` 中注册：

```tsx
import { FormProvider, SchemaField } from "@alien-form/react";

<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema} />
</FormProvider>
```

完整注册示例（参考 `apps/demo/src/components/schema-renderer.tsx`）：

```tsx
const components = {
  // 普通字段组件
  Input: SchemaInput,
  Textarea: SchemaTextarea,
  Select: SchemaSelect,
  Checkbox,
  Switch,
  DateInput,
  ImageInput,
  RadioGroup,
  Rating,
  // 高阶组件（布局/容器）
  FormGrid,
  FormLayout,
  FormSection,
  // 高阶组件（数组）
  ArrayCards,
  ArrayTable,
  SkuTable,
};

const decorators = {
  // FormItem 包装器
  FormItem,
};
```

---

# 一、普通组件

普通组件是最基础的自定义组件类型。它编辑一个字段的单一值，遵循标准 `value/onChange` 协议。

## 组件接口契约

React 渲染层自动从 field 映射出以下 props 传入普通组件：

```tsx
interface FieldComponentProps {
  // 核心值协议
  value: any;                              // 当前字段值
  onChange: (value: any) => void;          // 值变更回调

  // 状态 props
  disabled?: boolean;                      // 是否禁用
  loading?: boolean;                       // 是否加载中

  // 可选扩展（由字段状态提供）
  dataSource?: Array<{ label: string; value: any }>; // 选项数据源

  // + componentProps 展开的自定义属性
  [key: string]: any;
}
```

## 完整示例：ImageInput

一个带图片预览的 URL 输入组件（`apps/demo/src/components/image-input.tsx`）：

```tsx
interface ImageInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ImageInput: React.FC<ImageInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
}) => {
  const imageUrl = value ?? "";

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            <img src={imageUrl} alt="预览" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">无图片</span>
          )}
        </div>
        <div className="flex-1">
          <input
            value={imageUrl}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};
```

对应 Schema：

```json
{
  "image": {
    "type": "string",
    "title": "规格图片",
    "component": "ImageInput",
    "decorator": "FormItem",
    "props": {
      "placeholder": "输入图片 URL"
    }
  }
}
```

## 设计原则

1. **只编辑一个字段值** — 普通组件通过 `value/onChange` 管理单一值
2. **视觉可以复杂** — 内部 UI 可以任意丰富（预览、弹窗、拖拽），只要最终通过 `onChange` 返回一个值
3. **不创建字段子树** — 如果需要多个独立校验/联动的字段，应该用 object/array 高阶组件

## 反模式

```tsx
// ❌ 不要把多字段业务塞进一个对象值组件
interface ProductEditorProps {
  value?: { name: string; price: number; stock: number };
  onChange?: (value: any) => void;
}
```

如果这些子值需要独立路径、独立校验、独立联动、独立错误展示，它们应该是字段树（用 `object` 高阶组件），而不是一个对象值组件。

---

# 二、高阶组件

高阶组件是"返回组件值的容器"——它自身作为容器存在，包装并组织内部的子字段。根据 `type` 的不同，有三种场景。

## 三种场景总览

| 场景 | Schema 结构 | 路径行为 | 值行为 | 典型用途 |
| --- | --- | --- | --- | --- |
| 分组容器 | `void + component + properties` | 路径透明，子字段继承父前缀 | 不贡献值 | 卡片、栅格、分步、折叠面板 |
| 对象容器 | `object + component + properties` | 贡献路径前缀 | 子字段值聚合为对象 | 地址组、联系人信息、嵌套配置 |
| 数组容器 | `array + component + items` | 贡献路径前缀 + 行索引 | 子字段值聚合为数组 | 动态表格、可增删列表、规格矩阵 |

---

### 场景 1：分组容器 `void + component + properties`

**用途：** 纯 UI 分组，自身不产出任何值，子字段路径不经过它。

#### 组件接口

```tsx
interface VoidGroupComponentProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  fields?: Record<string, React.ReactNode>; // 子字段按 key 索引
  // + schema.props 展开
}
```

不接收 `field` 实例、不接收 `value/onChange`。

#### Schema 示例

```json
{
  "basicCard": {
    "type": "void",
    "title": "基本信息",
    "component": "FormSection",
    "props": { "bordered": true, "collapsible": true },
    "properties": {
      "name": { "type": "string", "component": "Input", "decorator": "FormItem" },
      "age": { "type": "number", "component": "Input", "decorator": "FormItem" }
    }
  }
}
```

**路径结果：** `name`、`age`（不是 `basicCard.name`）

**值结果：** `{ name: "张三", age: 28 }`

#### 现有实现

| 组件 | 文件 | 说明 |
| --- | --- | --- |
| `FormSection` | `packages/ui/src/components/form-section.tsx` | 带标题、描述、可折叠的分区卡片 |
| `FormGrid` | `packages/ui/src/components/form-grid.tsx` | 多列栅格布局 |
| `FormLayout` | `packages/ui/src/components/form-layout.tsx` | 水平/垂直弹性布局 |

#### FormSection 完整 Props

```tsx
interface FormSectionProps {
  title?: string;
  description?: string;
  bordered?: boolean;         // 是否有边框，默认 true
  collapsible?: boolean;      // 是否可折叠，默认 false
  defaultCollapsed?: boolean; // 默认是否收起，默认 false
  children?: React.ReactNode;
  className?: string;
}
```

#### FormGrid 完整 Props

```tsx
interface FormGridProps {
  columns?: number;  // 列数，默认 2
  gap?: number;      // 间距（*4px），默认 4
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}
```

#### FormLayout 完整 Props

```tsx
interface FormLayoutProps {
  direction?: "horizontal" | "vertical"; // 方向，默认 vertical
  gap?: number;                          // 间距（*4px），默认 4
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}
```

---

### 场景 2：对象容器 `object + component + properties`

**用途：** 包装一组字段为一个结构化对象值。子字段路径以该节点 key 为前缀。

#### 组件接口

```tsx
interface ObjectComponentProps {
  field: IField;                            // 字段实例（可读 field.value 等）
  fields?: Record<string, React.ReactNode>; // 子字段按 key 索引
  title?: string;
  description?: string;
  children?: React.ReactNode;
  // + schema.props 展开
}
```

接收 `field` 实例，但值编辑通过子字段完成。

#### Schema 示例

```json
{
  "address": {
    "type": "object",
    "title": "收货地址",
    "component": "AddressGroup",
    "properties": {
      "province": { "type": "string", "component": "Select", "decorator": "FormItem" },
      "city": { "type": "string", "component": "Select", "decorator": "FormItem" },
      "detail": { "type": "string", "component": "Input", "decorator": "FormItem" }
    }
  }
}
```

**路径结果：** `address.province`、`address.city`、`address.detail`

**值结果：** `{ address: { province: "浙江", city: "杭州", detail: "..." } }`

#### 自定义对象容器示例

```tsx
const AddressGroup: React.FC<ObjectComponentProps> = ({ field, title, children }) => {
  return (
    <div className="border rounded-lg p-4">
      {title && <h4 className="font-medium mb-3">{title}</h4>}
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
};
```

---

### 场景 3：数组容器 `array + component + items`

**用途：** 包装一个可动态增删行的数组字段。每行展开 `items` 定义的子字段树。

#### 组件接口

```tsx
interface ArrayComponentProps {
  field: IField;                                     // 数组字段实例
  rows: React.ReactNode[][];                         // 每行的子字段节点列表
  rowFields: Record<string, React.ReactNode>[];      // 每行的子字段按 key 索引
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
  // + schema.props 展开
}
```

#### Schema 示例

```json
{
  "contacts": {
    "type": "array",
    "title": "联系人列表",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "component": "Input", "decorator": "FormItem" },
        "phone": { "type": "string", "component": "Input", "decorator": "FormItem" }
      }
    }
  }
}
```

**路径结果：** `contacts.0.name`、`contacts.0.phone`、`contacts.1.name`...

**值结果：** `{ contacts: [{ name: "...", phone: "..." }, ...] }`

#### 现有实现

| 组件 | 文件 | 说明 |
| --- | --- | --- |
| `ArrayCards` | `packages/ui/src/components/array-cards.tsx` | 每行一个卡片，支持排序和删除 |
| `ArrayTable` | `packages/ui/src/components/array-table.tsx` | 紧凑表格样式，每行一条 |
| `SkuTable` | `apps/demo/src/components/sku-table.tsx` | 业务级：规格矩阵表格 |

#### ArrayCards / ArrayTable 完整 Props

```tsx
interface ArrayCardsProps {
  rows?: React.ReactNode[][];
  onAdd?: (initialValues?: Record<string, any>) => void;
  onRemove?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  disabled?: boolean;
  maxItems?: number;     // 最大行数限制
  addText?: string;      // 添加按钮文案，默认 "+ Add Item"
  className?: string;
}
```

---

## 对比表

| 维度 | `void` 分组 | `object` 对象 | `array` 数组 |
| --- | --- | --- | --- |
| 自身有值 | 否 | 是（对象） | 是（数组） |
| 子字段路径含自身 key | 否（透明） | 是 | 是 |
| 子字段 value/onChange | 各自独立 | 各自独立，聚合到 object | 各自独立，聚合到 array |
| 可增删行 | 否 | 否 | 是 |
| 组件接收 field 实例 | 否 | 是 | 是（含数组方法） |

## 选择决策树

```
你需要一个可见容器来组织字段吗？
├─ 否 → 普通字段组件
├─ 是 → 容器需要在 form.values 中产出值吗？
│  ├─ 否 → void（分组容器）
│  └─ 是 → 值是对象还是数组？
│     ├─ 对象 → object（对象容器）
│     └─ 数组 → array（数组容器）
```

---

# 三、FormItem 组件（Decorator）

FormItem 是**包装器组件（Decorator）**，不是字段组件。它负责渲染字段的"外壳"：标签、必填标记、校验错误、描述文案。

## 工作原理

React 渲染层按以下顺序组合组件：

```
[Decorator（FormItem）]
  └── [Component（Input/Select/...）]
```

即：先渲染字段组件得到输入控件，再用 Decorator 包裹它。

## 组件接口契约

```tsx
interface FormItemProps {
  // 由渲染层自动注入
  label?: string;                               // 来自 field.title
  required?: boolean;                           // 来自 field.required
  errors?: Array<{ message: string }>;          // 来自 field.errors
  warnings?: Array<{ message: string }>;        // 来自 field.warnings
  description?: string;                         // 来自 field.description
  validateStatus?: "success" | "error" | "warning" | "validating"; // 来自 field.validateStatus
  children?: React.ReactNode;                   // 字段组件渲染结果

  // + decoratorProps 展开的自定义属性
  [key: string]: any;
}
```

## 当前实现

`packages/ui/src/components/form-item.tsx`：

```tsx
const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ label, required, errors = [], warnings = [], description, children, className }, ref) => {
    const hasError = errors.length > 0;
    const hasWarning = warnings.length > 0;

    return (
      <div ref={ref} className={cn("space-y-2 mb-4", className)}>
        {label && (
          <Label className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <div>{children}</div>
        {description && !hasError && !hasWarning && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {hasError && (
          <p className="text-xs text-destructive">{errors.map((e) => e.message).join(", ")}</p>
        )}
        {!hasError && hasWarning && (
          <p className="text-xs text-yellow-600">{warnings.map((w) => w.message).join(", ")}</p>
        )}
      </div>
    );
  },
);
```

## Schema 用法

在任何字段（普通字段或高阶组件）上通过 `"decorator": "FormItem"` 引用：

```json
{
  "name": {
    "type": "string",
    "title": "姓名",
    "component": "Input",
    "decorator": "FormItem",
    "decoratorProps": {
      "className": "max-w-md"
    }
  }
}
```

## 自定义 Decorator 示例

如果默认 FormItem 不满足需求，可以自定义：

```tsx
// 紧凑模式 FormItem（水平排列标签和输入）
const InlineFormItem: React.FC<FormItemProps> = ({
  label,
  required,
  errors = [],
  children,
}) => (
  <div className="flex items-center gap-3 mb-2">
    {label && (
      <label className="w-24 text-sm text-right shrink-0">
        {required && <span className="text-red-500">*</span>}
        {label}
      </label>
    )}
    <div className="flex-1">
      {children}
      {errors.length > 0 && (
        <p className="text-xs text-red-500 mt-1">{errors[0].message}</p>
      )}
    </div>
  </div>
);

// 注册
const decorators = {
  FormItem,
  InlineFormItem,
};
```

在 Schema 中使用：

```json
{
  "email": {
    "type": "string",
    "title": "邮箱",
    "component": "Input",
    "decorator": "InlineFormItem"
  }
}
```

## Decorator 与高阶组件的关系

高阶组件也可以有 Decorator。例如数组容器配合 FormItem 来展示数组级别的标题和错误：

```json
{
  "contacts": {
    "type": "array",
    "title": "联系人",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "items": { ... }
  }
}
```

此时渲染层为：

```
[FormItem label="联系人"]
  └── [ArrayCards rows=...]
```

---

# 渲染链路总结

```
FormProvider 注入 components/decorators
  └── SchemaField 解析 schema
        └── SchemaFieldItem 判断节点类型
              ├── void + properties  → 高阶组件（分组容器）
              ├── object + component + properties → 高阶组件（对象容器）+ 可选 Decorator
              ├── array + items → 高阶组件（数组容器）+ 可选 Decorator
              └── 普通字段 → FieldRenderer
                    └── components[field.component] 渲染
                    └── decorators[field.decorator] 包裹
```

## 一句话原则

- **普通组件** — 吃 `value/onChange`，编辑单个字段值
- **高阶组件** — 吃 `children/field`，组织子字段树
- **FormItem** — 吃 `label/errors/children`，包装字段外观
