# Components API

所有 UI 组件都从 `@alien-form/ui` 导出，但真正接入 AlienForm 时，必须先理解 React 层给组件传的协议 props，而不是只看组件自己的 props。

## 先看统一组件契约

通过 `FieldRenderer` 注册的普通字段组件，至少会收到这些字段协议：

```ts
{
  value,
  onChange,
  disabled,
  readOnly,
  readPretty,
  loading,
  pattern,
  dataSource,
  ...field.componentProps,
}
```

这意味着：

- `Select`、`Checkbox`、`Switch`、`Rating` 这类组件，通常可以直接注册。
- `Input`、`Textarea` 这种原生事件组件，需要自己把 `event.target.value` 适配成 `onChange(value)`。

## 文本输入类

### Input

源码类型：`React.InputHTMLAttributes<HTMLInputElement>`。

推荐适配方式：

```tsx
const InputAdapter = ({ value, onChange, ...rest }: any) => (
  <Input
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    {...rest}
  />
)
```

适合：普通文本、数字、密码等输入。

### Textarea

源码类型：`React.TextareaHTMLAttributes<HTMLTextAreaElement>`。

```tsx
const TextareaAdapter = ({ value, onChange, ...rest }: any) => (
  <Textarea
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    {...rest}
  />
)
```

### ItemInput

| props | 说明 |
| --- | --- |
| `value?: string[]` | 标签列表 |
| `onChange?: (value: string[]) => void` | 值变化 |
| `placeholder?: string` | 占位提示 |
| `maxItems?: number` | 最大条目数 |

适合标签、关键字、白名单等字符串数组录入。

## 选择与布尔类

### Select

| props | 说明 |
| --- | --- |
| `value?: any` | 当前值 |
| `onChange?: (value: any) => void` | 选择后回调 |
| `dataSource?: SelectOption[]` | 选项数组 |
| `multiple?: boolean` | 是否多选 |
| `placeholder?: string` | 占位文案 |
| `disabled?: boolean` | 禁用 |

- 支持单选和多选。
- `dataSource` 为空时，下拉面板显示 `No options`。

### RadioGroup

| props | 说明 |
| --- | --- |
| `value?: any` | 当前值 |
| `onChange?: (value: any) => void` | 变更回调 |
| `dataSource?: RadioOption[]` | 单选项 |
| `direction?: 'horizontal' | 'vertical'` | 排列方向 |

### Checkbox

| props | 说明 |
| --- | --- |
| `value?: boolean` | 是否选中 |
| `onChange?: (value: boolean) => void` | 切换回调 |
| `label?: string` | 组件内部标签 |
| `disabled?: boolean` | 禁用 |

### Switch

| props | 说明 |
| --- | --- |
| `value?: boolean` | 开关状态 |
| `onChange?: (value: boolean) => void` | 切换回调 |
| `disabled?: boolean` | 禁用 |

### Rating

| props | 说明 |
| --- | --- |
| `value?: number` | 当前评分 |
| `onChange?: (value: number) => void` | 点击评分 |
| `max?: number` | 星级上限，默认 5 |
| `size?: 'sm' | 'md' | 'lg'` | 尺寸 |
| `disabled?: boolean` | 禁用 |

### DateInput

| props | 说明 |
| --- | --- |
| `value?: string` | 日期字符串 |
| `onChange?: (value: string) => void` | 日期变化 |
| `min?: string` / `max?: string` | 范围限制 |
| `placeholder?: string` | 占位文案 |

## 装饰器

### FormItem

`FormItem` 是当前默认 decorator。`FieldRenderer` / `ArrayFieldRenderer` 会自动给它注入：

- `label`
- `required`
- `errors`
- `warnings`
- `description`
- `validateStatus`
- `pattern`

自定义 decorator 只要兼容这组字段，就能无缝接入当前渲染器。

## 布局组件

### FormGrid

| props | 说明 |
| --- | --- |
| `columns?: number` | 列数，默认 2 |
| `gap?: number` | 间距倍率，最终乘以 4px |
| `title?: string` | 小标题 |
| `description?: string` | 描述 |

适合在 `type: 'void'` 节点下做多列表单布局。

### FormLayout

| props | 说明 |
| --- | --- |
| `direction?: 'horizontal' | 'vertical'` | 排列方向 |
| `gap?: number` | 间距倍率 |
| `title?: string` | 小标题 |
| `description?: string` | 描述 |

### FormSection

| props | 说明 |
| --- | --- |
| `title?: string` | 分组标题 |
| `description?: string` | 分组描述 |
| `bordered?: boolean` | 是否带边框 |
| `collapsible?: boolean` | 是否可折叠 |
| `defaultCollapsed?: boolean` | 初始是否折叠 |

## 数组组件

### ArrayCards

| props | 说明 |
| --- | --- |
| `rows?: ReactNode[][]` | 每一行已经渲染好的字段节点 |
| `onAdd` / `onRemove` / `onMoveUp` / `onMoveDown` | 数组操作回调 |
| `maxItems?: number` | 最大条目数 |
| `addText?: string` | 添加按钮文案 |
| `disabled?: boolean` / `readOnly?: boolean` | 状态控制 |

视觉形态是卡片列表，适合联系人、地址列表、审批节点等场景。

### ArrayTable

props 基本与 `ArrayCards` 一致，只是视觉形态改成“表格风格的分行布局”，更适合明细行录入。

## Demo：基础字段接入

```tsx
const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
  Checkbox,
  Switch,
  DateInput,
  RadioGroup,
  Rating,
}
```

## Demo：布局与数组字段

下面的 schema 片段来自 `apps/demo/src/schema/02-layout-and-collections.json`：

```json
{
  "basicSection": {
    "type": "void",
    "title": "基础信息",
    "component": "FormSection",
    "props": {
      "bordered": true,
      "collapsible": true
    },
    "properties": {
      "basicGrid": {
        "type": "void",
        "component": "FormGrid",
        "props": {
          "columns": 2,
          "gap": 4
        },
        "properties": {
          "projectName": {
            "type": "string",
            "title": "项目名称",
            "component": "Input",
            "decorator": "FormItem"
          },
          "riskLevel": {
            "type": "number",
            "title": "风险评分",
            "component": "Rating",
            "decorator": "FormItem",
            "props": { "max": 5 }
          }
        }
      }
    }
  },
  "contacts": {
    "type": "array",
    "title": "项目联系人",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "props": { "addText": "+ 添加联系人" }
  },
  "milestones": {
    "type": "array",
    "title": "里程碑明细",
    "component": "ArrayTable",
    "decorator": "FormItem",
    "props": { "addText": "+ 添加里程碑" }
  }
}
```

## Demo：展示模式与组件 props 联动

下面的片段来自 `apps/demo/src/schema/06-state-and-display.json`：

```json
{
  "nickname": {
    "type": "string",
    "title": "昵称",
    "component": "Input",
    "decorator": "FormItem",
    "x-reaction": {
      "pattern": {
        "type": "match",
        "dependencies": { "mode": "mode" },
        "match": {
          "readonly": "readPretty",
          "default": "editable"
        }
      },
      "props": {
        "type": "expression",
        "dependencies": { "mode": "mode" },
        "expression": "{ placeholder: $deps.mode === 'readonly' ? '当前为只读模式' : '请输入昵称' }"
      }
    }
  }
}
```

这个例子很好地说明了两件事：

- 组件不需要自己理解联动协议，它只消费 `pattern`、`readPretty`、`props` 等最终结果。
- 真正的联动逻辑发生在 `@alien-form/core`，UI 组件保持纯展示。
