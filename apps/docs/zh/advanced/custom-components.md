# 自定义组件

通过自定义字段组件和装饰器扩展 FormBao。

## 组件契约

`@formily-bao/react` 中 `FieldRenderer` 传入的属性：

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
  ...field.componentProps
}
```

## 示例

```tsx
function ColorPicker({ value, onChange, disabled, presets = [] }) {
  return (
    <div>
      <input type="color" value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      {presets.map(c => (
        <button key={c} onClick={() => onChange(c)} disabled={disabled}>
          <span style={{ background: c, width: 16, height: 16 }} />
        </button>
      ))}
    </div>
  )
}
```

## 注册

```tsx
<FormProvider
  form={form}
  components={{ Input, Select, ColorPicker }}
  decorators={{ FormItem }}
>
  <SchemaField schema={schema} />
</FormProvider>
```

## ReadPretty 支持

当 `field.pattern === 'readPretty'` 时，`FieldRenderer` 查找：
1. `components['ComponentName.ReadPretty']`
2. `components['ReadPretty.ComponentName']`

```tsx
ColorPicker.ReadPretty = ({ value }) => (
  <span style={{ background: value }}>{value}</span>
)
```

## 自定义装饰器

装饰器接收 `label`、`required`、`errors`、`warnings`、`description`、`validateStatus`、`pattern`、`children` 及 `field.decoratorProps`。

```tsx
function InlineDecorator({ children, label, required, errors }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <label>{required && '*'}{label}</label>
      {children}
      {errors?.[0] && <span style={{ color: 'red' }}>{errors[0].message}</span>}
    </div>
  )
}
```

## 使用 FieldContext

```tsx
import { useField } from '@formily-bao/react'

function SmartInput(props) {
  const field = useField()
  return <input {...props} />
}
```
