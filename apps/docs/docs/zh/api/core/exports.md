# @alien-form/core 导出项

## 描述

`@alien-form/core` 当前只公开一个运行时工厂 `createForm`，以及业务侧真正需要依赖的公共类型。

如果你在 React 项目中使用 AlienForm，通常直接从 `@alien-form/react` 导入 `createForm`、`IForm` 等能力即可；`react` 包已经做了重导出。

## 运行时导出

```ts
export { createForm } from "./engine/form/index";
```

| 导出项 | 类型 | 说明 |
| --- | --- | --- |
| `createForm` | function | 创建表单运行时实例，返回值类型为 `IForm` |

## 类型导出

```ts
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldMutableState,
  ValidateStatus,
  FieldDisplayTypes,
  FieldPatternTypes,
  Validator,
  ValidatorFn,
  ValidatorRule,
  FormConfig,
  FormError,
  EffectOptions,
  EffectContext,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  DataSourcePolicy,
  SchemaTypes,
} from "./schema/types";
```

## 常用导入方式

### 创建表单

```ts
import { createForm } from "@alien-form/core";

const form = createForm();
```

### 标注表单类型

```ts
import type { IForm, FormConfig } from "@alien-form/core";

const config: FormConfig = {
  initialValues: {},
};

const useFormModel = (form: IForm) => {
  return form.values;
};
```

### 标注 handler 类型

```ts
import type { RuntimeRuleHandler } from "@alien-form/core";

const loadOptions: RuntimeRuleHandler = async (ctx) => {
  return [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ];
};
```

## 导出项分组

### 运行时与配置

- `createForm`
- `IForm`
- `FormConfig`
- `FormError`
- `EffectOptions`
- `EffectContext`

### 字段与状态

- `IField`
- `IFormSchema`
- `IFieldSchema`
- `FieldError`
- `FieldMutableState`
- `ValidateStatus`
- `FieldDisplayTypes`
- `FieldPatternTypes`

### 校验与规则扩展

- `Validator`
- `ValidatorFn`
- `ValidatorRule`
- `RuntimeRuleHandler`
- `RuntimeRuleHandlerContext`
- `DataSourcePolicy`
- `SchemaTypes`

## 注意事项

- `Form`、`Field` 类不再属于公开运行时导出面；文档中的模型能力以 `IForm`、`IField` 为准。
- `createForm` 返回的是长期存活的运行时对象，不是一次性的配置快照。
- 表单联动统一使用 `setup + form.effect(...)`；不再推荐围绕事件式 `onXxx` API 组织逻辑。
