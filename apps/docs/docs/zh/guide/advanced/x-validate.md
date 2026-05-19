# x-validate

`x-validate` 用来描述动态校验逻辑。与静态 `validators` 不同，它支持表达式、依赖字段、以及通过 handler 执行复杂甚至异步的校验。

## 真实结构

当前实现里，`x-validate` 本身就是一个 `SchemaRuleSet`，也就是“一条规则”或“规则数组”。

```json
{
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : '两次输入的密码不一致'"
  }
}
```

它支持的规则类型同样只有四种：

- `static`
- `expression`
- `match`
- `computed`

## 执行时机

`x-validate` 不会在每次输入时自动运行。

当前实现里，它只会在以下时机执行：

- 调用 `field.validate()`
- 调用 `form.validate()`
- 调用 `form.submit()`

这意味着如果你希望输入时就触发实时校验，需要由 UI 层或上层交互显式调用校验，而不是假设 `x-validate` 会自动随输入运行。

## 校验顺序

字段校验的顺序是固定的：

1. 如果字段 `display === 'none'`，直接跳过。
2. 执行 `required` 校验。
3. 执行静态 `validators`。
4. 执行 `x-validate`。

因此，`x-validate` 是在标准规则之后执行的动态补充层，而不是完全替代静态 validators。

## 典型用法

### 1. 表达式校验

```json
{
  "type": "string",
  "title": "用户名",
  "x-validate": {
    "type": "expression",
    "expression": "$value === 'admin' ? undefined : '用户名必须是 admin'"
  }
}
```

在当前实现里：

- 返回 `undefined` / `null` / `true` 代表通过
- 返回 `false` 代表失败，但没有具体消息
- 返回 `string` 会被当成错误消息
- 返回 `object` 或 `array` 会被归一化为 `FieldError[]`

### 2. 跨字段校验

```json
{
  "type": "string",
  "title": "确认密码",
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : '两次输入的密码不一致'"
  }
}
```

这类写法非常适合：

- 确认密码
- 开始/结束时间比较
- 最小值 / 最大值联动约束
- 跨字段业务一致性检查

### 3. 异步校验

```json
{
  "type": "string",
  "title": "异步确认码",
  "x-validate": {
    "type": "computed",
    "handler": "checkConfirmCode"
  }
}
```

```ts
const form = createForm({
  handlers: {
    checkConfirmCode: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return value === "OK" ? undefined : "确认码必须为 OK";
    },
  },
});
```

这说明当前项目里，真正复杂的动态校验应该放到 `handlers` 中，而不是把函数直接塞进 Schema。

## handler 上下文

`computed` 类型的校验 handler 接收的是上下文对象，而不是裸值。可用字段包括：

- `field`
- `form`
- `values`
- `deps`
- `dependencies`
- `scope`
- `key`
- `rule`
- `value`
- `kind`

其中：

- `values` 是原始值快照，不是经过 `x-format.output` 处理后的提交值
- `deps` 是依赖值
- `kind` 在这里是 `x-validate`

## 规则数组行为

`x-validate` 支持写成数组：

```json
{
  "x-validate": [
    {
      "type": "expression",
      "expression": "$value ? undefined : '不能为空'"
    },
    {
      "type": "expression",
      "expression": "$value.length >= 6 ? undefined : '至少 6 位'"
    }
  ]
}
```

数组规则会按顺序执行，并把所有错误累积起来。

注意：它不是像 `x-format` 那样的值管道。每条校验规则看到的仍然是同一个字段值，而不是前一条规则加工后的结果。

## 可见性边界

`display: 'none'` 的字段不会参与校验。

这意味着如果一个字段被真正移出运行时可见范围：

- 它不会出现在 `form.values`
- 它也不会出现在 `form.validate()` 的校验流程里

而 `display: 'hidden'` 的字段仍然会参与值输出和校验，这一点和 `none` 有本质区别。

## 什么时候该用 x-validate

适合：

- 依赖其他字段的动态校验
- 业务规则型校验
- 需要异步请求参与的校验
- 无法仅靠静态 `validators` 描述的复杂校验

不适合：

- 所有简单必填、长度、正则校验都塞进 `x-validate`
- 把 UI 交互逻辑混进校验表达式
- 直接在 Schema 里写运行时代码函数

对于简单规则，应优先使用 `validators`；只有当规则确实依赖运行时上下文时，再使用 `x-validate`。
