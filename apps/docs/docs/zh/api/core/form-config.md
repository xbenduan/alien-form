# FormConfig

## 描述

`FormConfig` 是传递给 `createForm(config)` 的配置对象。它用于设置初始值、表达式作用域、`computed` handler、运行时错误监听和表单 effects。

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  initialValues: {
    province: "zhejiang",
  },
  scope: {
    readonlyMode: "readonly",
  },
  handlers: {
    async loadCities(ctx) {
      return fetchCities(ctx.deps.province);
    },
  },
  effects(form) {
    form.onValuesChange((values) => {
      console.log(values);
    });
  },
  onError(error) {
    console.warn(error);
  },
});
```

## 签名

```ts
interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  effects?: (form: IForm) => void;
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}
```

## options 说明

| 选项            | 类型                                 | 说明                                                 |
| --------------- | ------------------------------------ | ---------------------------------------------------- |
| `initialValues` | `Record<string, any>`                | 字段初始值。字段创建时会按路径读取对应初始值         |
| `validateFirst` | `boolean`                            | 类型中保留的配置项；当前校验实现没有完整启用短路逻辑 |
| `effects`       | `(form: IForm) => void`              | 表单构造阶段执行的副作用注册函数                     |
| `scope`         | `Record<string, any>`                | 注入表达式和规则运行时作用域的自定义变量             |
| `handlers`      | `Record<string, RuntimeRuleHandler>` | `computed` 规则调用的业务处理函数注册表              |
| `onError`       | `(error: FormError) => void`         | 非致命运行时错误监听器                               |

## initialValues

`initialValues` 会在 `setSchema()` 创建字段时作为初始值来源。

```ts
const form = createForm({
  initialValues: {
    user: {
      name: "Alice",
    },
  },
});

form.setSchema({
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        name: {
          type: "string",
          component: "Input",
        },
      },
    },
  },
});

form.getField("user.name")?.value;
// 'Alice'
```

注意：`setInitialValues()` 只更新 reset 基线，不会自动写入当前值。如果是编辑态回填，通常需要：

```ts
form.setInitialValues(detail);
form.setValues(detail);
```

## scope

`scope` 会合并进表达式规则运行时作用域。它适合放置枚举表、常量和只读上下文数据；函数调用不属于 `expression`，需要放到 `computed` handler 中。

```ts
const form = createForm({
  scope: {
    adultAge: 18,
  },
});
```

在 schema 表达式里可以直接读取这些数据：

```ts
{
  type: 'expression',
  dependencies: { age: 'age' },
  expression: '$deps.age >= adultAge ? "visible" : "none"'
}
```

`expression` 使用受限解释器执行：支持字面量、变量读取、属性/索引访问、对象/数组字面量、算术/比较/逻辑运算和三元表达式；不支持函数调用、赋值、语句、`new`、`eval`、`Function`、`constructor`、`prototype` 或 `__proto__`。

内置作用域变量包括：

| 变量            | 说明                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `$self`         | 当前字段实例；在部分值格式化场景里可能为 `undefined`                   |
| `$form`         | 当前表单实例                                                           |
| `$values`       | 当前值对象；reaction 中为输出值，format/validate 中为内部原始值        |
| `$deps`         | 根据 `dependencies` 解析出的依赖值；数组依赖时为数组，对象依赖时为对象 |
| `$dependencies` | 根据 `dependencies` 解析出的对象形式依赖值                             |
| `$value`        | 当前字段值或当前格式化链路中的值                                       |

## handlers

`handlers` 用于承接 `computed` 规则。AlienForm 不把异步请求、副作用、鉴权、缓存策略写进 schema，而是让 schema 引用 handler 名称。

```ts
const form = createForm({
  handlers: {
    async loadCities(ctx) {
      return requestCities(ctx.deps.province);
    },
  },
});
```

schema 中引用：

```ts
{
  type: 'string',
  component: 'Select',
  'x-reaction': {
    dataSource: {
      type: 'computed',
      dependencies: { province: 'province' },
      handler: 'loadCities'
    }
  }
}
```

### RuntimeRuleHandlerContext

```ts
interface RuntimeRuleHandlerContext {
  field: IField;
  form: IForm;
  values: Record<string, any>;
  deps: Record<string, any>;
  dependencies: Record<string, any>;
  scope: Record<string, any>;
  key: SchemaReactionKey | "input" | "output" | "validate" | string;
  rule: SchemaXRule;
  value?: any;
  kind?: "x-reaction" | "x-format" | "x-validate";
}
```

| 字段           | 说明                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `field`        | 当前规则所属字段                                                                              |
| `form`         | 当前表单实例，可以读取字段、值、错误等                                                        |
| `values`       | 当前内部原始值快照，不会执行 `x-format.output`                                                |
| `deps`         | 依赖值对象；等同于 `dependencies`                                                             |
| `dependencies` | 根据 `rule.dependencies` 解析后的依赖值对象                                                   |
| `scope`        | 完整表达式作用域，包含内置变量和自定义 `scope`                                                |
| `key`          | 当前规则作用的键；reaction 中是目标属性，format 中是 `input/output`，validate 中是 `validate` |
| `rule`         | 当前规则对象，可读取 `rule.params`                                                            |
| `value`        | 当前字段值或格式化链路中的当前值                                                              |
| `kind`         | 当前规则来源：`x-reaction`、`x-format` 或 `x-validate`                                        |

### handler 返回值约定

| 使用位置          | 返回值                   | 是否可异步          | 说明                                          |
| ----------------- | ------------------------ | ------------------- | --------------------------------------------- |
| `x-reaction`      | 目标属性值               | 可以                | Promise 会被等待，并自动维护字段 `loading`    |
| `x-format.input`  | 转换后的输入值           | 不建议 / 当前会报错 | 格式化链路是同步链路，不能返回 Promise        |
| `x-format.output` | 转换后的输出值           | 不建议 / 当前会报错 | `form.values` 是同步 getter，不能返回 Promise |
| `x-validate`      | 错误信息、错误数组或空值 | 可以                | 返回值会被标准化为 `FieldError[]`             |

## effects

`effects` 在 `Form` 构造阶段同步执行，接收当前 `form` 实例。它适合注册订阅、错误监听和生命周期回调。

```ts
const form = createForm({
  effects(form) {
    form.onValuesChange((values) => {
      console.log("values changed", values);
    });

    form.onFieldChange("*", (field) => {
      console.log("field changed", field.path);
    });
  },
});
```

### effects 可调用的方法

常用：

- `form.onValuesChange(listener)`
- `form.onFieldChange(path, listener)`
- `form.onError(listener)`
- `form.getField(path)`
- `form.setFieldState(path, setter)`
- `form.setValues(values)`
- `form.validate()`
- `form.submit(onSubmit)`

可用但要谨慎：

- `form.setSchema(schema)`：会重建字段树。
- `form.createField(path, schema, value)`：通常不建议绕过 schema 手动创建。
- `form.reset()`：会触发值变化和 reaction 重放。
- 在 `onValuesChange()` 中调用 `setValues()`：需要条件判断，避免循环。

### onLifecycle

`form.onLifecycle(event, path, handler)` 用于订阅字段生命周期事件，已经是 `IForm` 的公开 API。

```ts
createForm({
  effects(form) {
    form.onLifecycle("onFieldValidateFailed", "*", (field) => {
      console.log("validate failed", field.path);
    });
  },
});
```

支持事件：

- `onFieldInit`
- `onFieldMount`，预留，当前 core 不主动触发
- `onFieldUnmount`，预留，当前 core 不主动触发
- `onFieldValueChange`
- `onFieldInputValueChange`
- `onFieldInitialValueChange`，预留，当前 core 不主动触发
- `onFieldValidateStart`
- `onFieldValidateEnd`
- `onFieldValidateFailed`
- `onFieldValidateSuccess`

## onError

当 reaction、format、validate、`$ref` 解析等运行时流程发生非致命错误时，会通过 `onError` 抛出结构化错误。

```ts
interface FormError {
  scope: FormErrorScope;
  path: string;
  key?: string;
  message: string;
  cause?: unknown;
}
```

支持的 `scope`：

- `reaction`
- `x-reaction`
- `x-format`
- `x-validate`
- `ref-resolve`
- `expression`

如果没有注册 `onError` 或 `form.onError()` 监听器，运行时会 fallback 到 `console.warn`。
