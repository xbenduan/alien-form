# 组件

所有组件从 `@formily-bao/ui` 导出，通过 `FormProvider` 注册。

## 表单控件

### Input

```json
{ "x-component": "Input", "x-component-props": { "placeholder": "...", "type": "text" } }
```

### Textarea

```json
{ "x-component": "Textarea", "x-component-props": { "rows": 4 } }
```

### Select

```json
{
  "x-component": "Select",
  "enum": [{ "label": "选项A", "value": "a" }, { "label": "选项B", "value": "b" }]
}
```

### Checkbox / Switch

```json
{ "type": "boolean", "x-component": "Checkbox" }
{ "type": "boolean", "x-component": "Switch" }
```

### RadioGroup

```json
{ "x-component": "RadioGroup", "enum": ["小", "中", "大"] }
```

### DateInput

```json
{ "type": "date", "x-component": "DateInput" }
```

### Rating

```json
{ "type": "number", "x-component": "Rating", "x-component-props": { "max": 5 } }
```

## 数组组件

### ArrayCards

卡片式可重复布局：

```json
{
  "type": "array",
  "x-component": "ArrayCards",
  "x-component-props": { "title": "联系人" },
  "items": {
    "properties": {
      "name": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" },
      "phone": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" }
    }
  }
}
```

### ArrayTable

表格式可重复布局：

```json
{
  "type": "array",
  "x-component": "ArrayTable",
  "items": {
    "properties": {
      "name": { "type": "string", "title": "姓名", "x-component": "Input" },
      "qty": { "type": "number", "title": "数量", "x-component": "Input" }
    }
  }
}
```

## 布局组件

使用 `type: "void"` — 不产生表单值。

### FormGrid

```json
{ "type": "void", "x-component": "FormGrid", "x-component-props": { "columns": 2, "gap": 16 } }
```

### FormLayout

```json
{ "type": "void", "x-component": "FormLayout", "x-component-props": { "direction": "horizontal" } }
```

### FormSection

```json
{ "type": "void", "title": "标题", "x-component": "FormSection", "x-component-props": { "bordered": true, "collapsible": true } }
```

## 装饰器

### FormItem

标准字段包装器。自动接收：`label`、`required`、`errors`、`warnings`、`description`、`validateStatus`、`pattern`。

## 组件属性契约

每个组件从 `FieldRenderer` 接收：

```ts
{
  value: any
  onChange: (val) => void
  disabled: boolean
  readOnly: boolean
  readPretty: boolean
  loading: boolean
  pattern: string
  dataSource?: Array<{label, value}>
  ...componentProps
}
```
