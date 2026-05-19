# Schema API

AlienForm 的 Schema 基于 JSON Schema，但当前实现只支持仓库里真的消费到的那部分协议。理解这页时，请始终把 Schema 当成“驱动 `Form.createField()` 和 React 渲染层的配置对象”，而不是完整的 JSON Schema 解释器。

## 根 Schema

根节点类型是 `IFormSchema`：

```ts
interface IFormSchema {
  type: 'object'
  title?: string
  description?: string
  required?: boolean | string[]
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

- `type` 当前要求是 `'object'`。
- `properties` 是字段树入口。
- `definitions` 只用于 `#/definitions/...` 形式的 `$ref`。

## 字段 Schema

`IFieldSchema` 由两部分组成：JSON Schema 子集 + AlienForm 扩展协议。

### 当前支持的标准字段

| 字段 | 说明 |
| --- | --- |
| `type` | 支持 `string`、`number`、`boolean`、`object`、`array`、`void`、`date`、`datetime` |
| `title` / `description` | 字段标题和描述 |
| `default` | 默认值 |
| `required` | `true` 或父级 `required: string[]` |
| `enum` | 会被归一化成 `dataSource` |
| `const` | 静态校验项 |
| `minimum` / `maximum` / `exclusiveMinimum` / `exclusiveMaximum` / `multipleOf` | 数字校验 |
| `minLength` / `maxLength` / `pattern` / `format` | 字符串校验 |
| `minItems` / `maxItems` / `uniqueItems` | 数组校验 |
| `properties` / `items` | 对象与数组结构 |
| `definitions` / `$ref` | 局部定义与引用 |
| `readOnly` | 会参与 pattern 推导 |

### AlienForm 扩展字段

| 字段 | 当前行为 |
| --- | --- |
| `order` | 决定同级字段排序 |
| `state` | 初始 `display` / `pattern` / `visible` / `hidden` / `readOnly` / `readPretty` / `disabled` |
| `validators` | 静态校验器，可传函数、规则对象或数组 |
| `component` | 渲染组件名 |
| `props` | 组件 props，进入 `field.componentProps` |
| `decorator` | 装饰器组件名 |
| `decoratorProps` | 装饰器 props |
| `dataSource` | 选项数据 |
| `dataSourcePolicy` | 选项变化后的值保留策略：`preserve` / `clear` / `filter` / `first` |
| `content` | 非输入型内容节点，存在时直接渲染内容 |
| `data` | 字段私有元信息 |
| `layoutProps` | 传给 void 布局容器的额外布局参数 |
| `x-reaction` | 字段属性联动 |
| `x-format` | 输入态 / 输出态格式化 |
| `x-validate` | 动态校验 |

## x-reaction

`x-reaction` 的 key 是“你想改哪个字段属性”，value 是一条规则或规则数组。

### 当前支持的 reaction key

当前源码支持以下 key：

- `value`
- `display`
- `visible`
- `hidden`
- `pattern`
- `disabled`
- `readOnly`
- `readPretty`
- `editable`
- `required`
- `title`
- `description`
- `props`
- `decoratorProps`
- `component`
- `decorator`
- `dataSource`

超出这份列表的 key 不会生效，当前实现会通过 `onError` 上报 `unsupported reaction key`。

### 四种规则类型

| `type` | 用途 |
| --- | --- |
| `static` | 直接写死一个值 |
| `expression` | 执行受控表达式 |
| `match` | 按分支映射值 |
| `computed` | 调业务层 handler，可同步也可异步 |

### dependencies 的两种写法

```json
{
  "dependencies": ["country", "city"]
}
```

- 在表达式里通过 `$deps[0]`、`$deps[1]` 访问。

```json
{
  "dependencies": {
    "category": "category",
    "type": "contactType"
  }
}
```

- 在表达式里通过 `$deps.category`、`$deps.type` 访问。
- 当前实现同时会把完整对象暴露为 `$dependencies`。

### Demo：字段显隐与异步选项

下面的片段摘自 `apps/demo/src/schema/03-x-reaction-detail.json`：

```json
{
  "contactType": {
    "type": "string",
    "title": "联系方式",
    "component": "Select",
    "decorator": "FormItem",
    "dataSource": [
      { "label": "邮箱", "value": "email" },
      { "label": "电话", "value": "phone" },
      { "label": "飞书", "value": "lark" }
    ]
  },
  "email": {
    "type": "string",
    "title": "邮箱地址",
    "component": "Input",
    "decorator": "FormItem",
    "x-reaction": {
      "display": {
        "type": "match",
        "dependencies": { "contactType": "contactType" },
        "match": {
          "email": "visible",
          "default": "none"
        }
      }
    }
  },
  "subCategory": {
    "type": "string",
    "title": "子分类",
    "component": "Select",
    "decorator": "FormItem",
    "dataSourcePolicy": "clear",
    "x-reaction": {
      "dataSource": {
        "type": "computed",
        "dependencies": { "category": "category" },
        "handler": "fetchSubCategories"
      },
      "disabled": {
        "type": "expression",
        "dependencies": { "category": "category" },
        "expression": "!$deps.category"
      }
    }
  }
}
```

## x-format

`x-format` 用于值进入字段前和提交输出前的同步变换：

```ts
interface SchemaFormat {
  input?: SchemaRuleSet
  output?: SchemaRuleSet
}
```

- `input` 在 `default`、`initialValues`、`setValues()` 进入字段前执行。
- `output` 在读取 `form.values` 时执行。
- 当前实现是同步链路，所以 `x-format` 中的 `computed` handler 必须同步返回值。

### Demo：金额换算与编码标准化

下面的片段来自 `apps/demo/src/schema/04-x-format.json`：

```json
{
  "amount": {
    "type": "number",
    "title": "金额（页面展示元，提交输出分）",
    "default": 12345,
    "component": "Input",
    "decorator": "FormItem",
    "x-format": {
      "input": {
        "type": "expression",
        "expression": "$value / 100"
      },
      "output": {
        "type": "expression",
        "expression": "Number($value) * 100"
      }
    }
  },
  "code": {
    "type": "string",
    "title": "编码（trim + uppercase）",
    "x-format": {
      "input": { "type": "computed", "handler": "normalizeCode" },
      "output": { "type": "computed", "handler": "normalizeCode" }
    }
  }
}
```

## x-validate

`x-validate` 会在静态 validators 之后执行。当前源码把结果归一化为 `FieldError[]`，支持以下返回值：

| 返回值 | 结果 |
| --- | --- |
| `undefined` / `null` / `true` | 通过 |
| `false` | 失败，生成 `Invalid value` |
| `string` | 失败，字符串直接作为错误消息 |
| `object` | 可写成 `{ message, type }` 或校验规则对象 |
| `array` | 每一项都会继续按上面的规则归一化 |

### Demo：表达式校验 + 异步校验

下面的片段来自 `apps/demo/src/schema/05-x-validate.json`：

```json
{
  "username": {
    "type": "string",
    "title": "用户名",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "expression",
      "expression": "$value === 'admin' ? undefined : '用户名必须是 admin'"
    }
  },
  "confirmPassword": {
    "type": "string",
    "title": "确认密码",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "expression",
      "dependencies": { "password": "password" },
      "expression": "$value === $deps.password ? undefined : '两次输入的密码不一致'"
    }
  },
  "confirmCode": {
    "type": "string",
    "title": "异步确认码",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "computed",
      "handler": "checkConfirmCode"
    }
  }
}
```

## 数组与布局节点

### 数组字段

当前只有 `items` 为对象且带 `properties` 时，才会走数组字段模式，并启用 `push` / `remove` / `moveUp` / `moveDown`。

### void 布局节点

`type: 'void'` 表示它本身不进入 `form.values`，但如果带 `component`，React 层仍会把它当布局容器渲染。

## 需要注意的真实实现细节

- `enum` 和 `dataSource` 最终都会进 `field.dataSource`，并支持 `{ key, title }` 转 `{ label, value }`。
- `readOnly: true` 会参与 pattern 推导，最终可能表现为 `readOnly`。
- `$ref` 仅支持 `#/definitions/Name` 这种本地定义引用，不支持远程引用。
