# @alien-form/react

> AlienForm 的 React 绑定层。
> 它把 `@alien-form/core` 的无头运行时接入 React，提供表单实例生命周期、Signal 订阅、上下文 Provider 和 Schema 渲染组件。

`@alien-form/react` 是 React 项目接入 AlienForm 时通常唯一需要直接安装的包。它会重新导出核心类型和 `createForm`，并提供一组 Hooks 让组件可以精确订阅字段状态。

## 特性

- **一站式 React 入口**：重新导出 `@alien-form/core` 的常用类型和 `createForm`。
- **生命周期安全**：`useCreateForm` 负责创建、挂载、卸载和销毁表单实例。
- **Signal 到 React**：`useSignalValue` 基于 `useSyncExternalStore` 订阅 Signal。
- **Schema 渲染**：`SchemaField` 按 Schema 自动渲染 primitive、object、array、void 字段。
- **组件库无关**：通过 `components` 和 `decorators` 注入任意 React 组件。
- **细粒度 Hooks**：提供字段值、错误、显隐、禁用、必填、loading、表单值和提交状态订阅。

## 安装

```bash
pnpm add @alien-form/react @alien-form/core
```

`react` 是 peer dependency：

```bash
pnpm add react react-dom
```

## 快速开始

```tsx
import { FormProvider, SchemaField, useCreateForm } from "@alien-form/react";

const schema = {
  type: "object",
  properties: {
    name: {
      $ref: "#/definitions/textInput",
      title: "姓名",
      required: true,
    },
  },
};

const components = {
  Input(props: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) {
    return (
      <input
        value={props.value ?? ""}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.(event.target.value)}
      />
    );
  },
};

const decorators = {
  FormItem(props: {
    label?: string;
    required?: boolean;
    errors?: Array<{ message: string }>;
    children?: React.ReactNode;
  }) {
    return (
      <label>
        <span>
          {props.label}
          {props.required ? " *" : ""}
        </span>
        {props.children}
        {props.errors?.map((error) => (
          <div key={error.message} style={{ color: "red" }}>
            {error.message}
          </div>
        ))}
      </label>
    );
  },
};

export function App() {
  const form = useCreateForm(
    {
      schema,
      definitions: {
        textInput: {
          type: "string",
          component: "Input",
          decorator: "FormItem",
          props: {
            placeholder: "请输入姓名",
          },
        },
      },
    },
    [schema],
  );

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
      <button type="button" onClick={() => form.submit(console.log)}>
        提交
      </button>
    </FormProvider>
  );
}
```

## 组件契约

### Primitive 组件

Primitive 字段渲染时，组件会收到这些常用 props：

```ts
type PrimitiveComponentProps = {
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  loading: boolean;
  dataSource?: Array<{ label: string; value: any }>;
  [key: string]: any;
};
```

示例：

```tsx
function Select(props: {
  value?: string;
  onChange?: (value: string) => void;
  dataSource?: Array<{ label: string; value: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value ?? ""}
      disabled={props.disabled}
      onChange={(event) => props.onChange?.(event.target.value)}
    >
      <option value="">请选择</option>
      {props.dataSource?.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
```

### Decorator 组件

Decorator 用于包裹字段组件，常见用途是渲染 label、必填标识、描述、错误和布局。

```ts
type DecoratorProps = {
  label?: string;
  required?: boolean;
  errors?: Array<{ message: string; type?: string }>;
  warnings?: Array<{ message: string; type?: string }>;
  description?: string;
  validateStatus?: "success" | "error" | "warning" | "validating" | "";
  children?: React.ReactNode;
  [key: string]: any;
};
```

### Array 组件

Array 字段组件会收到行节点、每行 children 和操作方法：

```ts
type ArrayComponentProps = {
  field: ArrayFieldNode;
  rows: React.ReactNode[][];
  rowNodes: RowNode[];
  rowFields: Record<string, React.ReactNode>[];
  onAdd: (initialValues?: Record<string, any>) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMove: (from: number, to: number) => void;
  disabled: boolean;
  [key: string]: any;
};
```

示例：

```tsx
function ArrayCards(props: {
  rows: React.ReactNode[][];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      {props.rows.map((row, index) => (
        <section key={index}>
          {row}
          {!props.disabled && (
            <button type="button" onClick={() => props.onRemove(index)}>
              删除
            </button>
          )}
        </section>
      ))}
      {!props.disabled && (
        <button type="button" onClick={() => props.onAdd()}>
          新增
        </button>
      )}
    </div>
  );
}
```

### Object 组件

Object 字段如果声明了 `component`，会作为容器组件渲染：

```ts
type ObjectComponentProps = {
  field: ObjectFieldNode;
  fields: Record<string, React.ReactNode>;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  [key: string]: any;
};
```

如果 object 字段没有声明 `component`，`SchemaField` 会直接递归渲染其子字段。

### Void 组件

Void 字段只参与布局，不参与输出值。它适合分组、栅格、提示区块等 UI 容器。

```ts
{
  type: "void",
  component: "Grid",
  properties: {
    firstName: { type: "string", component: "Input" },
    lastName: { type: "string", component: "Input" },
  },
}
```

## Public API

### `useCreateForm(config, deps)`

创建并管理 `FormInstance` 生命周期。

```tsx
const form = useCreateForm(
  {
    schema,
    initialValues,
    handlers,
    onError(error) {
      console.warn(error);
    },
  },
  [schema],
);
```

行为说明：

- `deps` 不变时复用同一个表单实例。
- `deps` 变化时创建新实例，并销毁旧实例。
- 如果 `config.schema`、`config.definitions`、`config.handlers` 或 `initialValues` 来自组件状态、props 或 `useMemo`，请把对应引用放进 `deps`。
- 组件挂载时调用 `form.mount()`。
- 组件卸载时调用 `form.unmount()`。
- 兼容 React StrictMode 重挂载场景。

`useCreateForm` 接收完整 `FormConfig`，因此也可以传入 `definitions`：

```tsx
const fieldDefinitions = {
  textInput: {
    type: "string",
    component: "Input",
    decorator: "FormItem",
    props: { placeholder: "请输入昵称" },
  },
  memberName: {
    type: "string",
    component: "Input",
    decorator: "FormItem",
  },
};

const form = useCreateForm(
  {
    schema,
    definitions: fieldDefinitions,
    handlers,
  },
  [schema, fieldDefinitions, handlers],
);
```

### `FormProvider`

把表单实例、组件映射和装饰器映射注入 React Context。

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField />
</FormProvider>
```

类型：

```ts
type ComponentMap = Record<string, React.ComponentType<any>>;
type DecoratorMap = Record<string, React.ComponentType<any>>;
```

### `SchemaField`

根据当前 `form.schema` 自动渲染整棵字段树。

```tsx
<SchemaField />
```

`SchemaField` 必须位于 `FormProvider` 内部。

### `useForm()`

读取当前表单实例。

```tsx
function SubmitButton() {
  const form = useForm();

  return (
    <button type="button" onClick={() => form.submit(console.log)}>
      提交
    </button>
  );
}
```

### `useSignalValue(signal)`

订阅任意 Alien Signal 或 Computed。

```tsx
function ValidIndicator() {
  const form = useForm();
  const valid = useSignalValue(form.valid);

  return <span>{valid ? "校验通过" : "存在错误"}</span>;
}
```

### 字段 Hooks

| Hook | 返回值 | 说明 |
| --- | --- | --- |
| `useFieldAtoms(path)` | `FieldNode | undefined` | 读取字段节点。 |
| `useFieldValue(path)` | `any` | 读取 primitive 字段值。 |
| `useFieldErrors(path)` | `FieldError[]` | 读取字段错误。 |
| `useFieldDisplay(path)` | `FieldDisplayTypes` | 读取字段显隐状态。 |
| `useFieldDisabled(path)` | `boolean` | 读取禁用状态。 |
| `useFieldRequired(path)` | `boolean` | 读取必填状态。 |
| `useFieldLoading(path)` | `boolean` | 读取 loading 状态。 |

示例：

```tsx
function NamePreview() {
  const name = useFieldValue("name");
  const errors = useFieldErrors("name");

  return (
    <div>
      <strong>{name}</strong>
      {errors.map((error) => (
        <p key={error.message}>{error.message}</p>
      ))}
    </div>
  );
}
```

### 表单 Hooks

| Hook | 返回值 | 说明 |
| --- | --- | --- |
| `useFormValues()` | `Record<string, any>` | 读取投影后的表单值。 |
| `useFormValid()` | `boolean` | 读取表单是否有效。 |
| `useFormSubmitting()` | `boolean` | 读取提交状态。 |
| `useFormErrors()` | `FieldError[]` | 读取表单错误集合。 |
| `useFormSubmit()` | `{ submit, submitting }` | 获取提交方法和提交状态。 |
| `useFormValidate()` | `{ validate }` | 获取校验方法。 |

示例：

```tsx
function Toolbar() {
  const valid = useFormValid();
  const { submit, submitting } = useFormSubmit();

  return (
    <button
      type="button"
      disabled={!valid || submitting}
      onClick={() => submit((values) => console.log(values))}
    >
      {submitting ? "提交中" : "提交"}
    </button>
  );
}
```

## 完整 Schema 示例

```tsx
import { FormProvider, SchemaField, useCreateForm } from "@alien-form/react";
import type { IFormSchema } from "@alien-form/react";

const schema: IFormSchema = {
  type: "object",
  definitions: {
    textInput: {
      type: "string",
      component: "Input",
      decorator: "FormItem",
    },
  },
  properties: {
    role: {
      type: "string",
      title: "角色",
      required: true,
      component: "Select",
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "用户", value: "user" },
      ],
    },
    permissions: {
      type: "string",
      title: "权限",
      component: "Select",
      dataSourcePolicy: "first",
      "x-reaction": {
        display: "{{ role ? 'visible' : 'none' }}",
        dataSource: "@loadPermissions",
      },
    },
    profile: {
      type: "object",
      title: "资料",
      component: "SectionCard",
      properties: {
        nickname: {
          $ref: "#/definitions/textInput",
          title: "昵称",
        },
      },
    },
  },
};

const fieldDefinitions = {
  textInput: {
    type: "string",
    component: "Input",
    decorator: "FormItem",
    props: { placeholder: "请输入昵称" },
  },
};

const handlers = {
  loadPermissions(ctx) {
    return ctx.get("role") === "admin"
      ? [{ label: "全部权限", value: "*" }]
      : [{ label: "只读", value: "read" }];
  },
};

export function UserForm() {
  const form = useCreateForm(
    {
      schema,
      definitions: fieldDefinitions,
      handlers,
    },
    [schema, fieldDefinitions, handlers],
  );

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
```

这里同时展示了两类 `definitions`：

- `schema.definitions` 是 `$ref` 的引用字典，`profile.nickname` 通过 `#/definitions/textInput` 复用字段结构。
- `config.definitions` 由 `useCreateForm` 传给 core，并合并到 `schema.definitions` 供 `$ref` 显式引用。
- 只有 schema 写了对应 `$ref` 的字段才会获得 `config.definitions` 中的定义。
- 当两者包含同名定义时，`config.definitions` 会覆盖 `schema.definitions` 中的同名定义，引用位置的本地属性仍优先生效。

## 与 `@alien-form/core` 的关系

`@alien-form/react` 不改变核心运行时协议，只做三件事：

- 管理 `FormInstance` 在 React 组件生命周期中的挂载与卸载。
- 把 Signal 状态安全地桥接到 React 渲染。
- 按 `component` / `decorator` 字符串从映射表中找到真实 React 组件。

复杂联动、校验、格式化、数组操作和提交逻辑仍然由 `@alien-form/core` 负责。

## 开发

```bash
pnpm --filter @alien-form/react run test
pnpm --filter @alien-form/react run build
```
