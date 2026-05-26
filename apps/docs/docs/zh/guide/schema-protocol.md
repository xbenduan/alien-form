# Schema 协议

AlienForm 的 Schema 是一份会被 core 编译为字段树和运行时规则的协议。它本质上是三部分的组合：

- **静态结构**：字段路径、嵌套关系、数组项
- **运行时投影**：组件、装饰器、初始状态、数据源
- **动态规则**：`x-reaction`、`x-format`、`x-validate`

## 根节点

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}
```

入口：`form.setSchema(schema)` 或 `<SchemaField schema={schema} />`。

执行过程：清空旧字段 → 缓存 `definitions` → 按 `order` 排序 → 递归创建字段树 → 安装 `x-reaction`。

---

## 字段完整属性表

### JSON Schema 标准子集

| 字段 | 类型 | 说明 | 运行时映射 |
| --- | --- | --- | --- |
| `type` | `SchemaTypes` | 字段类型：`string` \| `number` \| `boolean` \| `object` \| `array` \| `void` \| `date` \| `datetime` | 决定节点行为（值节点 / 布局节点 / 数组节点） |
| `title` | `string` | 字段标题 | → `field.title` |
| `description` | `string` | 字段描述 | → `field.description` |
| `default` | `any` | 默认值，优先级低于 `initialValues` | → `field.initialValue`（经 `x-format.input` 后） |
| `required` | `boolean \| string[]` | 是否必填。根节点上为 `string[]` 时表示哪些子字段必填 | → `field.required` + 内置 required 校验器 |
| `minimum` | `number` | 最小值（`>=`） | → 校验器 |
| `maximum` | `number` | 最大值（`<=`） | → 校验器 |
| `exclusiveMinimum` | `number` | 排他最小值（`>`） | → 校验器 |
| `exclusiveMaximum` | `number` | 排他最大值（`<`） | → 校验器 |
| `multipleOf` | `number` | 必须是该值的倍数 | → 校验器 |
| `minLength` | `number` | 字符串最小长度 | → 校验器 |
| `maxLength` | `number` | 字符串最大长度 | → 校验器 |
| `pattern` | `string` | 正则表达式（字符串形式） | → 校验器 |
| `format` | `ValidatorFormats` | 预置格式：`email` \| `url` \| `phone` \| `number` \| `integer` \| `idcard` \| `ip` \| `ipv6` \| `zip` | → 校验器 |
| `minItems` | `number` | 数组最少项数 | → 校验器 |
| `maxItems` | `number` | 数组最多项数 | → 校验器 |
| `uniqueItems` | `boolean` | 数组是否要求每项唯一 | → 校验器 |
| `const` | `any` | 值必须严格等于该常量 | → 校验器 |
| `properties` | `Record<string, IFieldSchema>` | 对象子属性 | → 递归创建子字段 |
| `items` | `IFieldSchema` | 数组项 schema | → 数组行模板 |
| `$ref` | `string` | 引用根级 `definitions`，格式为 `#/definitions/Name` | → 展开后合并到当前节点 |

### AlienForm 扩展字段

| 字段 | 类型 | 说明 | 运行时映射 |
| --- | --- | --- | --- |
| `order` | `number` | 渲染排序权重，越小越靠前 | → 字段创建顺序 |
| `component` | `string` | 组件注册键名（在 `components` 注册表中查找） | → `field.component` |
| `props` | `Record<string, any>` | 传给组件的 props | → `field.componentProps` |
| `decorator` | `string` | 装饰器注册键名（在 `decorators` 注册表中查找） | → `field.decorator` |
| `decoratorProps` | `Record<string, any>` | 传给装饰器的 props | → `field.decoratorProps` |
| `state` | `Partial<{display, pattern, disabled, readOnly, readPretty, editable}>` | 字段初始状态声明 | → `field.display` + `field.pattern` |
| `validators` | `Validator \| Validator[]` | 静态校验规则（函数或规则对象） | → 校验流程第 3 步 |
| `dataSource` | `Array<{label, value, ...}>` | 静态选项源，进入运行时前会标准化 | → `field.dataSource` |
| `dataSourcePolicy` | `"preserve" \| "clear" \| "filter" \| "first"` | 数据源变化时如何处理当前值 | → 联动 dataSource 后的值调和策略 |
| `content` | `any` | 字段内容槽（传递给组件的附加内容） | → `field.content` |
| `data` | `Record<string, any>` | 字段私有数据槽 | → `field.data` |
| `x-reaction` | `SchemaReactions` | 动态字段属性派生规则（详见 [x-reaction](./advanced/x-reaction)） | → 响应式 effect |
| `x-format` | `{input?: SchemaRuleSet, output?: SchemaRuleSet}` | 值输入/输出转换（详见 [x-format](./advanced/x-format)） | → 字段创建时 + `form.values` 读取时 |
| `x-validate` | `SchemaRuleSet` | 动态校验规则（详见 [x-validate](./advanced/x-validate)） | → 校验流程第 4 步 |

### `state` 字段详解

`state` 是字段初始状态的声明入口，支持以下属性：

| 属性 | 类型 | 映射 |
| --- | --- | --- |
| `display` | `"visible" \| "hidden" \| "none"` | → `field.display`。`none` 会从 `form.values` 和校验中排除 |
| `pattern` | `"editable" \| "readOnly" \| "disabled" \| "readPretty"` | → `field.pattern` |
| `disabled` | `boolean` | `true` → `pattern: "disabled"` |
| `readOnly` | `boolean` | `true` → `pattern: "readOnly"` |
| `readPretty` | `boolean` | `true` → `pattern: "readPretty"` |
| `editable` | `boolean` | `false` → `pattern: "readOnly"` |

优先级：`pattern` > `readPretty` > `readOnly` > `disabled` > `editable`。

### `dataSourcePolicy` 详解

当 `dataSource` 因联动或异步加载更新后，字段当前值可能已不在新选项中。此策略控制如何调和：

| 策略 | 行为 |
| --- | --- |
| `preserve` | 保留原值不做处理（默认） |
| `clear` | 值不在新选项中时清为 `undefined` |
| `filter` | 数组值时过滤掉不在新选项中的项 |
| `first` | 值不在新选项中时自动选第一项 |

---

## 节点类型语义

### `object`

| 模式 | 条件 | 行为 |
| --- | --- | --- |
| 容器字段 | 有 `component` | 创建字段实例 + 递归子属性 |
| 透明分组 | 无 `component` | 仅作路径前缀，不创建字段，React 直接渲染子节点 |

### `void`

布局节点。不贡献值到 `form.values`，但可携带 `component`、`props`、`title`、`content`，并递归渲染子属性。

### `array`

| 模式 | 条件 | 行为 |
| --- | --- | --- |
| 复杂数组 | `items` 有 `properties` | 创建数组字段 + 每行展开子字段树 |
| 简单数组 | `items` 无 `properties` | 仅创建数组字段，不展开行字段 |

数组行字段路径格式：`arrayPath.{index}.childKey`。

---

## 规则模型（SchemaXRule）

`x-reaction`、`x-format`、`x-validate` 共享同一套规则类型：

| 类型 | 结构 | 说明 |
| --- | --- | --- |
| `static` | `{ type: "static", value: any }` | 返回固定值 |
| `expression` | `{ type: "expression", expression: string }` | 受限表达式求值（无函数调用，无赋值） |
| `match` | `{ type: "match", source?: string, match: Record<string, any> }` | 分支映射，`source` 可选 |
| `computed` | `{ type: "computed", handler: string, params?: Record<string, any> }` | 调用 `createForm({ handlers })` 中的函数 |

每条规则可附带 `dependencies`（`string[]` 或 `Record<string, string>`），声明依赖字段。

### 表达式上下文

| 变量 | 含义 |
| --- | --- |
| `$self` | 当前字段实例 |
| `$form` | 表单实例 |
| `$values` | 值快照 |
| `$deps` | 依赖值（数组依赖时为数组，对象依赖时为对象） |
| `$dependencies` | 依赖值对象 |
| `$value` | 当前字段值 |
| *scope 中注入的变量* | 来自 `createForm({ scope })` |

---

## `$ref` 与 `definitions`

仅支持 `"$ref": "#/definitions/Name"`，`definitions` 只能定义在根 `IFormSchema` 上。

合并规则：本地属性覆盖引用目标属性。

```json
{ "$ref": "#/definitions/UserName", "title": "申请人姓名" }
```

→ `title` 覆盖 definitions 中的原始标题。

---

## `form.values` 输出规则

`form.values` 不是原始值快照，而是经过以下过滤后的提交态对象：

1. 排除 `display === "none"` 的字段
2. 排除 `void` 节点
3. 排除数组子路径（数组字段已聚合行值）
4. 对每个输出值应用 `x-format.output`

> `display: "hidden"` 的字段仍然参与 `form.values` 和校验。
