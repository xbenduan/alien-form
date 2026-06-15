# @alien-form/core

> AlienForm 的无头表单运行时。
> 它不渲染任何 UI，只负责把 Schema 变成可响应的字段树，并执行联动、格式化、校验和提交投影。

`@alien-form/core` 是整个项目的地基。你可以把它理解成一个“表单状态机 + Schema Runtime”：输入一份 `IFormSchema`，得到一个 `FormInstance`，再由 React、Vue、自研 UI 或 CMS 系统负责消费字段状态并渲染界面。

## 特性

- **无 UI 依赖**：不依赖 React，不绑定任何组件库。
- **Signal 驱动**：基于 `alien-signals` 暴露字段状态、表单状态和 computed values。
- **Schema 字段树**：支持 primitive、object、array、void 四类字段节点。
- **运行时规则**：支持 `x-reaction`、`x-effect`、`x-format`、`x-validate`。
- **安全表达式子集**：表达式运行时不使用 `eval` / `new Function`。
- **数组模型**：支持行节点、增删移动、嵌套字段和稳定路径。
- **输出投影**：`form.values()`、`form.project()`、`form.submit()` 会按可见性和格式化规则输出。
- **错误通道**：通过 `FormConfig.onError` 和 `form.onError()` 接收非致命运行时错误。

## 安装

```bash
pnpm add @alien-form/core
```

如果在当前 monorepo 内开发：

```bash
pnpm --filter @alien-form/core run test
pnpm --filter @alien-form/core run build
```

## 最小示例

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        title: "姓名",
        required: true,
        component: "Input",
      },
      age: {
        type: "number",
        title: "年龄",
        component: "NumberInput",
        "x-validate": "{{ $value >= 18 ? true : '必须年满 18 岁' }}",
      },
    },
  },
  initialValues: {
    name: "Alien",
    age: 18,
  },
});

form.mount();

form.set("name", "AlienForm");
const valid = await form.validate();
const values = await form.submit();

form.unmount();
form.destroy();
```

## 核心概念

### `FormInstance`

`createForm(config)` 会返回一个表单实例。它持有完整 Schema、字段索引、根字段、表单值、校验状态和生命周期方法。

```ts
const form = createForm({ schema, initialValues });

form.mount();
form.set("profile.name", "Ada");

const field = form.field("profile.name");
const current = form.get("profile.name");
const values = form.values();
```

### `FieldNode`

每个 Schema 字段都会变成一个字段节点：

| 节点类型 | 对应 Schema | 说明 |
| --- | --- | --- |
| `PrimitiveFieldNode` | `string`、`number`、`boolean` 或自定义 primitive type | 拥有 `value` signal 和 `setValue()`。 |
| `ObjectFieldNode` | `type: "object"` | 拥有 `children`，用于组织嵌套字段。 |
| `ArrayFieldNode` | `type: "array"` | 拥有 `rows`，支持 `push()`、`remove()`、`move()` 等操作。 |
| `VoidFieldNode` | `type: "void"` | 只参与布局和状态，不参与输出值。 |

所有字段节点都拥有这些状态：

```ts
field.display(); // "visible" | "hidden" | "none"
field.disabled();
field.required();
field.errors();
field.warnings();
field.validateStatus();
field.title();
field.description();
field.component();
field.componentProps();
field.decorator();
field.decoratorProps();
field.dataSource();
field.loading();
```

### Signal

`@alien-form/core` 会重新导出 `alien-signals` 的常用能力：

```ts
import { signal, computed, effect, startBatch, endBatch } from "@alien-form/core";
```

Signal 是函数式读写：

```ts
const count = signal(0);

count(); // read
count(1); // write
```

## Schema 协议

### 基础字段

```ts
const schema = {
  type: "object",
  properties: {
    email: {
      type: "string",
      title: "邮箱",
      description: "用于接收通知",
      required: true,
      component: "Input",
      decorator: "FormItem",
      props: {
        placeholder: "请输入邮箱",
      },
    },
  },
};
```

### `required`

`required` 同时承担两个职责：

- 设置字段的必填 UI 状态：`field.required()`。
- 提供内置必填校验，错误消息为 `该字段为必填项`。

### `x-reaction`

`x-reaction` 用于声明字段联动，支持派生这些目标：

| 目标 | 说明 |
| --- | --- |
| `value` | 派生字段值。 |
| `rows` | 派生数组行。 |
| `display` | 设置 `visible`、`hidden`、`none`。 |
| `disabled` | 设置禁用状态。 |
| `required` | 设置必填状态。 |
| `title` / `description` | 派生标题和描述。 |
| `props` / `decoratorProps` | 派生组件参数和装饰器参数。 |
| `component` / `decorator` | 动态切换组件或装饰器。 |
| `dataSource` | 动态加载或派生选项。 |

```ts
const schema = {
  type: "object",
  properties: {
    country: {
      type: "string",
      component: "Select",
      dataSource: [
        { label: "中国", value: "cn" },
        { label: "美国", value: "us" },
      ],
    },
    city: {
      type: "string",
      component: "Select",
      dataSourcePolicy: "first",
      "x-reaction": {
        display: "{{ country ? 'visible' : 'none' }}",
        dataSource: "@loadCities",
      },
    },
  },
};

const form = createForm({
  schema,
  handlers: {
    loadCities(ctx) {
      return ctx.get("country") === "cn"
        ? [{ label: "杭州", value: "hangzhou" }]
        : [{ label: "New York", value: "new-york" }];
    },
  },
});
```

### `x-effect`

`x-effect` 用于字段挂载后的副作用逻辑。它与其他运行时值共享同一套上下文，可以读取字段、表单值和自定义 scope。

```ts
{
  type: "string",
  "x-effect": (ctx) => {
    return ctx.effect(() => {
      const value = ctx.get("keyword");
      console.log("keyword changed:", value);
    });
  },
}
```

### `x-format`

`x-format` 负责输入和输出格式化：

- `input`：只在初始化加载值时执行。
- `output`：在 `form.values()`、`form.project()`、`form.submit()` 时执行。
- `x-format` 必须是同步规则，返回 Promise 会被视为错误。

```ts
{
  type: "tags",
  default: [],
  "x-format": {
    input: ({ value }) => Array.isArray(value) ? value.filter(Boolean) : [],
    output: ({ value }) => Array.isArray(value) ? value.join(",") : value,
  },
}
```

### `x-validate`

`x-validate` 用于自定义校验。返回值语义如下：

| 返回值 | 结果 |
| --- | --- |
| `undefined` / `null` / `true` | 校验通过。 |
| `false` | 校验失败，使用默认错误消息。 |
| `string` | 校验失败，字符串作为错误消息。 |
| `{ message: string }` | 校验失败，结构化错误。 |
| `FieldError[]` | 多个结构化错误。 |

```ts
{
  type: "string",
  title: "邮箱",
  "x-validate": [
    "{{ $value ? true : '邮箱不能为空' }}",
    ({ value }) => /@/.test(value) ? true : "邮箱格式不正确",
  ],
}
```

### `$ref`

Schema 支持通过 `definitions` 和 `$ref` 复用字段定义：

```ts
const schema = {
  type: "object",
  definitions: {
    userName: {
      type: "string",
      component: "Input",
      required: true,
    },
  },
  properties: {
    creator: {
      $ref: "#/definitions/userName",
      title: "创建人",
    },
  },
};
```

## Runtime Value Model

AlienForm 在 `x-reaction`、`x-effect`、`x-format`、`x-validate` 中使用统一的运行时值模型：

| 类型 | 示例 | 说明 |
| --- | --- | --- |
| 字面量 | `"text"`、`100`、`true`、`{}`、`[]` | 直接作为结果使用。 |
| 表达式字符串 | `"{{ role === 'admin' }}"` | 在受限表达式运行时内求值。 |
| Handler 字符串 | `"@loadOptions"` | 从 `FormConfig.handlers` 中查找并执行。 |
| 直接函数 | `(ctx, form) => any` | 直接获得运行时上下文和表单实例。 |
| 数组 | `["{{ a }}", "@handler"]` | 按规则列表执行。 |

## 表达式上下文

表达式可以读取：

| 名称 | 说明 |
| --- | --- |
| `$self` | 当前字段节点。 |
| `$form` | 当前表单实例。 |
| `$values` | 当前表单值。 |
| `$value` | 当前字段值。 |
| `$row` | 当前数组行节点。 |
| `$path` | 当前字段路径。 |
| `$get(selector)` | 读取某个路径的值。 |
| `$project(selector?)` | 读取投影后的输出值。 |
| 自定义 scope | 来自 `FormConfig.scope`。 |

表达式也可以直接访问同级或顶层字段名：

```ts
{
  "x-reaction": {
    disabled: "{{ status === 'archived' }}",
  },
}
```

表达式支持字面量、成员访问、数组、对象、算术、比较、逻辑运算和三元表达式。

为了降低风险，表达式会拒绝：

- 函数调用。
- 赋值语句。
- 模板字符串。
- `eval`、`Function`、`window`、`document`、`process`。
- `constructor`、`prototype`、`__proto__`。

## Data Source Policy

当字段拥有 `dataSource` 且选项发生变化时，`dataSourcePolicy` 决定如何处理当前值：

| 策略 | 行为 |
| --- | --- |
| `preserve` | 保留当前值。 |
| `clear` | 当前值不在新选项中时清空。 |
| `filter` | 数组值中过滤非法项，标量非法时清空。 |
| `first` | 当前值非法时回退到第一个选项。 |

## Array 字段

数组字段会创建 `ArrayFieldNode`，并为每行创建 `RowNode`：

```ts
const members = form.field("members");

if (members?.kind === "array") {
  members.push({ name: "Ada" });
  members.moveUp(1);
  members.remove(0);
}
```

示例 Schema：

```ts
const schema = {
  type: "object",
  properties: {
    members: {
      type: "array",
      title: "成员",
      component: "ArrayCards",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "姓名",
            component: "Input",
          },
        },
      },
    },
  },
};
```

## Public API

### `createForm(config)`

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  schema,
  initialValues,
  scope,
  handlers,
  onError(error) {
    console.warn(error);
  },
});
```

### `FormConfig`

```ts
interface FormConfig {
  schema?: IFormSchema;
  initialValues?: Record<string, any>;
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}
```

### `FormInstance`

```ts
interface FormInstance {
  schema: IFormSchema;
  root: ObjectFieldNode;
  fields: Signal<Map<string, FieldNode>>;
  submitting: Signal<boolean>;
  values: Computed<Record<string, any>>;
  errors: Computed<FieldError[]>;
  valid: Computed<boolean>;

  field(path: string): FieldNode | undefined;
  get(selector: string): any;
  set(selector: string, value: any): void;
  project(selector?: string): any;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;

  mount(): void;
  unmount(): void;
  validate(): Promise<boolean>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  onError(listener: (error: FormError) => void): () => void;

  effect(runner: (form: FormInstance) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: FormInstance) => T,
    listener: (value: T, prev: T | undefined) => void,
    options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean },
  ): () => void;
}
```

### `RuntimeRuleContext`

```ts
interface RuntimeRuleContext {
  field: FieldNode;
  form: FormInstance;
  path: string;
  key?: string;
  kind: "x-reaction" | "x-effect" | "x-format" | "x-validate";
  schema: IFieldSchema | IFormSchema;
  row?: RowNode;
  scope: Record<string, any>;
  values: Record<string, any>;
  value?: any;

  get(selector: string): any;
  set(selector: string, value: any): void;
  project(selector?: string): any;
  effect(runner: () => void | (() => void)): () => void;
}
```

## 工具函数

`@alien-form/core` 还导出一些可复用工具：

```ts
import {
  evaluateExpression,
  getDeepValue,
  isEmptyValue,
  normalizeDataSource,
  resolveSchemaRef,
  resolveSchemaTree,
  setDeepValue,
  sortByOrder,
} from "@alien-form/core";
```

| API | 作用 |
| --- | --- |
| `evaluateExpression` | 执行受限表达式。 |
| `getDeepValue` / `setDeepValue` | 按点路径读写对象。 |
| `sortByOrder` | 按 Schema `order` 排序属性。 |
| `resolveSchemaRef` / `resolveSchemaTree` | 解析 `$ref`。 |
| `normalizeDataSource` | 标准化选项数据源。 |
| `isEmptyValue` | 判断空值，用于必填校验。 |

## 错误处理

运行时规则、表达式、格式化、校验和 `$ref` 解析中的非致命错误会进入错误通道：

```ts
const form = createForm({
  schema,
  onError(error) {
    reportToSentry(error);
  },
});

const unsubscribe = form.onError((error) => {
  console.warn(`[${error.scope}] ${error.path}: ${error.message}`);
});

unsubscribe();
```

`FormError.scope` 可能是：

```ts
type FormErrorScope =
  | "reaction"
  | "x-reaction"
  | "x-effect"
  | "x-format"
  | "x-validate"
  | "ref-resolve"
  | "expression";
```

## 与其他包的关系

- `@alien-form/react` 基于本包渲染 React Schema 表单。
- `@alien-form/cms` 复用本包的 Schema 类型，并在其上扩展 `x-cms` 模型元信息。
- 你也可以直接使用本包接入任意 UI 框架。

## 开发

```bash
pnpm test:core
pnpm build:core
```
