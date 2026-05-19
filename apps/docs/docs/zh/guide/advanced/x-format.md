# x-format

`x-format` 用来描述“值在进入字段前”和“值在输出表单结果前”的转换逻辑。它并不负责字段显隐或 UI 状态，而是专注于值的输入态 / 输出态转换。

典型场景包括：

- 后端返回“分”，页面展示“元”
- 接口值是数字枚举，组件值是语义字符串
- 输入和提交都需要统一做标准化处理，例如 `trim`、大写化、补前缀

## 真实结构

当前实现里，`x-format` 只有两个入口：`input` 和 `output`。

```json
{
  "x-format": {
    "input": {
      "type": "expression",
      "expression": "$value / 100"
    },
    "output": {
      "type": "expression",
      "expression": "($value || 0) * 100"
    }
  }
}
```

二者都使用和 `x-reaction` 相同的规则模型，也就是：

- `static`
- `expression`
- `match`
- `computed`

## 执行时机

这是 `x-format` 最容易被误解的地方。

### input 的真实执行时机

`input` 只会在以下时机执行：

1. 字段创建时，用于处理 `default` 或 `initialValues`。
2. 调用 `form.setValues()` 时。

**它不会在普通 UI 输入时自动执行。**

也就是说，用户在输入框里打字，默认走的是 `field.setValue()`，不会重新经过 `x-format.input`。如果文档把它描述成“每次输入都会自动经过 input 格式化”，那就是不符合当前实现的。

### output 的真实执行时机

`output` 会在以下时机执行：

1. 读取 `form.values` 时。
2. 调用 `form.submit()` 时。

因此，`output` 更像是“提交态转换”而不是“编辑态转换”。

## 典型用法

### 1. 金额换算

下面这个例子来自项目 demo：后端存的是“分”，页面展示的是“元”。

```json
{
  "type": "number",
  "title": "金额（页面展示元，提交输出分）",
  "default": 12345,
  "x-format": {
    "input": {
      "type": "expression",
      "expression": "$value / 100"
    },
    "output": {
      "type": "expression",
      "expression": "($value || 0) * 100"
    }
  }
}
```

这里的真实行为是：

- `default: 12345` 在字段创建时先经过 `input`，页面里看到的是 `123.45`
- 最终提交或读取 `form.values` 时再经过 `output`，恢复成 `12345`

### 2. 枚举值映射

```json
{
  "x-format": {
    "input": {
      "type": "match",
      "match": {
        "1": "enabled",
        "0": "disabled",
        "default": "disabled"
      }
    },
    "output": {
      "type": "match",
      "match": {
        "enabled": 1,
        "disabled": 0,
        "default": 0
      }
    }
  }
}
```

`match` 在 `x-format` 下默认直接使用当前 `$value` 作为匹配源，因此不写 `source` 也可以工作。

### 3. 复杂格式化交给 handler

```json
{
  "x-format": {
    "input": {
      "type": "computed",
      "handler": "normalizeCode"
    },
    "output": {
      "type": "computed",
      "handler": "normalizeCode"
    }
  }
}
```

```ts
const form = createForm({
  handlers: {
    normalizeCode: ({ value }) => String(value ?? '').trim().toUpperCase(),
  },
})
```

## 管道行为

`x-format` 支持 rule 数组，并且它是一个真正的串行管道。

也就是说：

- 第一条规则的输出会成为第二条规则的 `$value`
- 第二条规则的输出会成为第三条规则的 `$value`
- 最终返回最后一条规则的结果

这和 `x-validate` 不同，`x-validate` 是累积错误，不是值转换管道。

## 同步限制

当前实现里，`x-format` 必须是同步的。

如果 `x-format` 的某条规则返回了 Promise，运行时会直接报错，而不是等待异步结果。这一点很重要，因为它意味着：

- 不能把远程请求放进 `x-format`
- 不能把异步查询当成输入输出转换的一部分
- 需要异步获取数据时，应使用 `x-reaction.dataSource` 或外部业务逻辑

## 什么时候该用 x-format

适合：

- 接口值与展示值的双向映射
- 默认值和提交值的协议转换
- 同步的字符串标准化、枚举映射、金额换算

不适合：

- 普通输入过程中的实时格式化交互
- 依赖其他字段的 UI 联动
- 异步远程转换

如果你想做“用户一输入就立刻格式化显示”，那通常应该放在自定义组件适配器里，而不是依赖 `x-format.input`。
