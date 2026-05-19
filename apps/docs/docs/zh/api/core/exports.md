# @alien-form/core 导出项

## 描述

`@alien-form/core` 的入口文件导出了运行时工厂、模型类和所有公共类型。业务侧通常只需要直接使用 `createForm`，React 项目则通常通过 `@alien-form/react` 间接使用 core。

## 运行时导出

```ts
export { createForm, Form } from './form'
export { Field } from './field'
```

| 导出项 | 类型 | 说明 |
| --- | --- | --- |
| `createForm` | function | 创建表单模型的推荐入口 |
| `Form` | class | 表单模型实现类；通常不需要直接 new |
| `Field` | class | 字段模型实现类；通常由 `form.setSchema()` 创建 |

## 类型导出

```ts
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldValue,
  FieldState,
  ValidateStatus,
  FieldMutableState,
  SchemaXRuleType,
  SchemaReactionKey,
  SchemaXRule,
  SchemaRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  DataSourcePolicy,
  RuntimeRuleHandlerContext,
  RuntimeRuleHandler,
  SchemaTypes,
  FieldPatternTypes,
  FieldDisplayTypes,
  ValidatorFormats,
  Validator,
  ValidatorFn,
  ValidatorRule,
  FormConfig,
  FormError,
  FormErrorScope,
} from './types'
```

## 常用导入方式

### 创建表单

```ts
import { createForm } from '@alien-form/core'

const form = createForm()
```

### 标注表单类型

```ts
import type { IForm, FormConfig } from '@alien-form/core'

const config: FormConfig = {
  initialValues: {}
}

const useFormModel = (form: IForm) => {
  return form.values
}
```

### 标注 handler 类型

```ts
import type { RuntimeRuleHandler } from '@alien-form/core'

const loadOptions: RuntimeRuleHandler = async (ctx) => {
  return [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' }
  ]
}
```

## 导出项分组

### 表单模型

- `createForm`
- `Form`
- `IForm`
- `FormConfig`
- `FormError`
- `FormErrorScope`

### 字段模型

- `Field`
- `IField`
- `FieldError`
- `FieldValue`
- `FieldState`
- `FieldMutableState`
- `ValidateStatus`

### Schema 协议

- `IFormSchema`
- `IFieldSchema`
- `SchemaTypes`
- `SchemaXRuleType`
- `SchemaReactionKey`
- `SchemaXRule`
- `SchemaRule`
- `SchemaRuleSet`
- `SchemaReactions`
- `SchemaFormat`
- `SchemaXValidate`
- `DataSourcePolicy`

### 校验类型

- `ValidatorFormats`
- `Validator`
- `ValidatorFn`
- `ValidatorRule`

### 运行时扩展

- `RuntimeRuleHandler`
- `RuntimeRuleHandlerContext`
- `FormLifecycleEvent`
- `FormLifecycleHandler`

## 注意事项

- `createForm` 返回类型是 `IForm`，文档中的公开 API 以 `IForm` 为准。
- `Form` 和 `Field` 类可以导入，但业务代码通常不需要直接实例化。
- 字段生命周期订阅的公开 API 是 `onLifecycle`。
