# 组件

所有组件从 `@formily-bao/ui` 导出，通过 `FormProvider` 注册。

## 表单控件

### Input

```json
{ "component": "Input", "props": { "placeholder": "...", "type": "text" } }
```

### Textarea

```json
{ "component": "Textarea", "props": { "rows": 4 } }
```

### Select

```json
{
  "component": "Select",
  "enum": [{ "label": "选项A", "value": "a" }, { "label": "选项B", "value": "b" }]
}
```

### Checkbox / Switch

```json
{ "type": "boolean", "component": "Checkbox" }
{ "type": "boolean", "component": "Switch" }
```

### RadioGroup

```json
{ "component": "RadioGroup", "enum": ["小", "中", "大"] }
```

### DateInput

```json
{ "type": "date", "component": "DateInput" }
```

### Rating

```json
{ "type": "number", "component": "Rating", "props": { "max": 5 } }
```

## 数组组件

### ArrayCards

卡片式可重复布局：

```json
{
  "type": "array",
  "component": "ArrayCards",
  "props": { "title": "联系人" },
  "items": {
    "properties": {
      "name": { "type": "string", "component": "Input", "decorator": "FormItem" },
      "phone": { "type": "string", "component": "Input", "decorator": "FormItem" }
    }
  }
}
```

### ArrayTable

表格式可重复布局：

```json
{
  "type": "array",
  "component": "ArrayTable",
  "items": {
    "properties": {
      "name": { "type": "string", "title": "姓名", "component": "Input" },
      "qty": { "type": "number", "title": "数量", "component": "Input" }
    }
  }
}
```

## 布局组件

使用 `type: "void"` — 不产生表单值。

### FormGrid

```json
{ "type": "void", "component": "FormGrid", "props": { "columns": 2, "gap": 16 } }
```

### FormLayout

```json
{ "type": "void", "component": "FormLayout", "props": { "direction": "horizontal" } }
```

### FormSection

```json
{ "type": "void", "title": "标题", "component": "FormSection", "props": { "bordered": true, "collapsible": true } }
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
