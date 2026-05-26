# x-validate

`x-validate` 用来描述动态校验逻辑。与内置 `validate` 不同，它支持表达式、依赖字段、以及通过 handler 执行复杂甚至异步的校验。

## 真实结构

`x-validate` 本身就是一个 `SchemaRuleSet`，也就是"一条规则"或"规则数组"。

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

规则类型同为 `static` / `expression` / `match` / `computed`，详见 [Schema 协议 — 规则模型](../schema-protocol#规则模型schemarule)。

## 执行时机

`x-validate` 不会在每次输入时自动运行。

它只会在以下时机执行：

- 调用 `field.validate()`
- 调用 `form.validate()`
- 调用 `form.submit()`

如果你希望输入时就触发实时校验，需要由 UI 层显式调用校验。

## 校验管线

字段校验的顺序是固定的：

1. 如果字段 `display === 'none'`，直接跳过。
2. 执行 `validate` — 内置静态约束（`required`、`minLength`、`pattern` 等）。
3. 执行 `validators` — 用户自定义校验函数/规则对象。
4. 执行 `x-validate` — 动态规则。

因此，`x-validate` 是在内置约束之后执行的动态补充层。

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

返回值约定：

- `undefined` / `null` / `true` → 通过
- `false` → 失败（无具体消息）
- `string` → 作为错误消息
- `object` / `array` → 归一化为 `FieldError[]`

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

适合场景：

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

复杂的动态校验应放到 `handlers` 中，而不是把函数直接塞进 Schema。

## handler 上下文

`computed` handler 接收上下文对象（字段详见 [Schema 协议 — 表达式上下文](../schema-protocol#表达式上下文)），额外注意：`values` 是原始值快照（非 `x-format.output` 后的提交值），`kind` 为 `"x-validate"`。

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

数组规则按顺序执行，所有错误累积。每条规则看到的是同一个字段值，不是管道。

## 可见性边界

- `display: 'none'` → 不参与校验，不出现在 `form.values`
- `display: 'hidden'` → 仍参与校验和值输出

## 什么时候该用 x-validate

适合：

- 依赖其他字段的动态校验
- 业务规则型校验
- 需要异步请求参与的校验
- 无法用 `validate` 静态约束描述的规则

不适合：

- 所有简单必填、长度、正则校验都塞进 `x-validate`
- 把 UI 交互逻辑混进校验表达式
- 直接在 Schema 里写运行时代码函数

简单约束用 `validate`，需要运行时上下文时才用 `x-validate`。
