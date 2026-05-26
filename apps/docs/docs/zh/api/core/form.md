# Form

## 描述

这一页描述的是 `createForm()` 返回的 `IForm` 运行时对象。

`@alien-form/core` 不再把 `Form` 作为公开 class 导出；业务代码应通过工厂函数创建表单实例，并以 `IForm` 作为稳定的公开契约。

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  initialValues: {
    username: "alien",
  },
});
```

## createForm

### 签名

```ts
function createForm(config?: FormConfig): IForm;
```

`createForm` 返回一个长期存活的表单运行时对象。它不是普通数据快照，而是可读写、可订阅、可校验、可提交的 headless model。

### 最小示例

```ts
import { createForm } from "@alien-form/core";

const form = createForm();

form.setSchema({
  type: "object",
  properties: {
    username: {
      type: "string",
      title: "用户名",
      component: "Input",
      required: true,
    },
  },
});

form.setValues({ username: "alien" });

console.log(form.values);
// { username: "alien" }
```

## 主要属性

| 属性名 | 类型 | 说明 |
| --- | --- | --- |
| `fields` | `Map<string, IField>` | 已注册字段实例集合，key 为字段路径 |
| `values` | `Record<string, any>` | 输出值快照；会过滤不可见字段、`void` 节点和数组子路径，并应用 `x-format.output` |
| `initialValues` | `Record<string, any>` | `reset()` 使用的初始值基线 |
| `valid` | `boolean` | 当前可见字段是否全部通过校验 |
| `invalid` | `boolean` | `valid` 的反义值 |
| `submitting` | `boolean` | `submit()` 执行期间为 `true` |
| `errors` | `FieldError[]` | 所有可见字段的扁平错误列表 |

## 主要方法

### 字段访问与状态修改

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `createField` | `(path: string, schema: IFieldSchema, initialValue?: any) => IField` | 手动创建字段，一般只在底层或测试中使用 |
| `getField` | `(path: string) => IField \| undefined` | 读取字段实例 |
| `setFieldState` | `(path: string, setter: (state: Partial<FieldMutableState>) => void) => void` | 命令式修正字段状态 |

### 值与 schema

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `setValues` | `(values: Record<string, any>) => void` | 按已注册字段路径批量写值，并应用 `x-format.input` |
| `setInitialValues` | `(values: Record<string, any>) => void` | 更新 `reset()` 使用的初始值基线 |
| `reset` | `() => void` | 按当前初始值恢复字段并重放相关派生逻辑 |
| `setSchema` | `(schema: IFormSchema) => void` | 根据 schema 重建字段树、规则与派生能力 |

### 校验与提交流程

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `validate` | `() => Promise<boolean>` | 校验所有可见字段，全部通过时返回 `true` |
| `submit` | `<T = any>(onSubmit?: (values: Record<string, any>) => T \| Promise<T>) => Promise<T>` | 先校验，再执行提交回调；未传回调时返回 `form.values` |
| `destroy` | `() => void` | 释放 `setup` 注册的清理逻辑，以及运行期 effect/error 订阅 |

### 数组与响应式能力

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `getArrayField` | `(path: string) => IField \| undefined` | 获取数组字段实例 |
| `removeArrayItem` | `(arrayPath: string, index: number) => void` | 删除数组字段中的指定行 |
| `subscribe` | `(listener: () => void) => () => void` | 低层订阅接口，适合 bridge 层 |
| `effect` | `(runner) => () => void` 或 `(selector, listener, options?) => () => void` | 基于依赖读取注册副作用 |
| `onError` | `(listener: (error: FormError) => void) => () => void` | 订阅非致命运行时错误 |

数组字段本身还提供 `push()`、`remove()`、`moveUp()`、`moveDown()`，详见 [Field](./field)。

## setup 中如何使用 form

`setup` 拿到的就是同一个 `IForm` 实例。推荐把它当成“注册规则、桥接外部系统、集中清理副作用”的入口，而不是写大段命令式流程。

```ts
const form = createForm({
  setup(form) {
    const stopValues = form.effect((instance) => instance.values, (values) => {
      console.log("values changed", values);
    });

    const stopName = form.effect(
      (instance) => instance.getField("username")?.value,
      (value) => {
        console.log("username changed", value);
      },
    );

    const stopError = form.onError((error) => {
      console.warn(error.scope, error.path, error.message);
    });

    return () => {
      stopValues();
      stopName();
      stopError();
    };
  },
});
```

### 推荐使用

- `form.effect(runner)`：按依赖读取自动重跑
- `form.effect(selector, listener, options?)`：监听 selector 的前后值变化
- `form.onError(listener)`：收集 reaction、format、validate、`$ref` 解析等非致命错误
- `form.getField(path)`：在回调中读取字段实例
- `form.setFieldState(path, setter)`：做少量命令式状态修正
- `form.setValues(values)`：回填外部数据

### 谨慎使用

- `form.setSchema(schema)`：会清空旧字段树并重建
- `form.createField(path, schema, value)`：容易绕过 schema 协议边界
- `form.reset()`：会触发值回退与相关 effect 重放
- 在 `effect()` 中无条件调用 `setValues()`：容易形成循环

## 推荐副作用模式

AlienForm 当前统一使用 `setup + form.effect(...)` 表达复杂联动，而不是围绕路径事件模型组织逻辑。

```ts
createForm({
  setup(form) {
    return form.effect(
      (instance) => instance.getField("profile")?.value,
      (nextProfile, prevProfile) => {
        console.log("profile changed", nextProfile, prevProfile);
      },
      {
        immediate: true,
        equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
      },
    );
  },
});
```

## 输出值边界

`form.values` 不是所有字段原始值的简单拷贝，它会：

1. 跳过 `display === "none"` 的字段。
2. 跳过 `void` 布局节点。
3. 跳过数组子字段路径，由数组字段统一输出数组值。
4. 对字段值应用 `x-format.output`。

如果你在 `computed` handler 中读取 `context.values`，拿到的是内部原始值快照；读取 `form.values` 时拿到的是经过输出格式化后的值。

## 注意事项

- `setSchema()` 会清除旧字段、旧规则和旧派生逻辑后再重建。
- `setInitialValues()` 只更新 reset 基线，不会自动改写当前字段值；编辑态回填通常需要配合 `setValues()`。
- `setValues()` 只会写入当前已注册字段；schema 尚未设置时不会凭空创建字段。
- `values` 是派生状态，不要直接修改 `form.values.xxx`。
- `submit()` 校验失败时会抛出异常，并把错误消息数组挂在 `error.messages` 上。
- 如果 `effect()` 会反写字段，请自行保证逻辑收敛，避免无限循环。
