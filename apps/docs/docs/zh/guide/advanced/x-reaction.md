# x-reaction

`x-reaction` 是 AlienForm 中最核心的高阶协议之一。它负责根据依赖字段的值，派生当前字段的运行时状态，例如 `display`、`pattern`、`title`、`props`、`dataSource` 或 `value`。

## 真实结构

当前项目支持的真实结构不是单条规则对象加 `target`，而是“以目标属性名为 key”的对象：

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "contactType": "contactType"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    },
    "title": {
      "type": "expression",
      "dependencies": {
        "contactType": "contactType"
      },
      "expression": "$deps.contactType === 'email' ? '邮箱地址' : '联系方式'"
    }
  }
}
```

这里有几个必须记住的规则：

- `x-reaction` 的 key 就是要更新的字段属性名，不存在单独的 `target` 字段。
- 依赖字段名叫 `dependencies`，不是 `deps`。
- `expression` 规则使用 `expression` 字段。
- `match` 规则使用 `match` 字段。
- `expression` 使用受限表达式语法，不支持 `{{ ... }}` 模板语法，也不支持函数调用；复杂逻辑请使用 `computed`。

## 规则类型

支持 `static` / `expression` / `match` / `computed` 四种类型，详见 [Schema 协议 — 规则模型](../schema-protocol#规则模型schemarule)。

## 支持的目标属性

运行时明确支持以下 reaction key：

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

虽然类型上允许写任意字符串，但如果不是上述内置 key，运行时会通过 `onError` 报 `unsupported reaction key`，而不会真正生效。

## 依赖解析

`dependencies` 支持两种写法：

```json
{
  "dependencies": ["price", "quantity"]
}
```

数组依赖通过 `$deps[0]`、`$deps[1]` 访问。

```json
{
  "dependencies": {
    "price": "price",
    "quantity": "quantity"
  }
}
```

对象依赖通过 `$deps.price`、`$deps.quantity` 访问。

此外，相对路径也是支持的，例如数组子项里可以写 `.type`，运行时会相对当前字段的父级路径解析。

## 执行时机

`x-reaction` 在当前实现里有两个触发时机：

1. `form.setSchema()` 之后初始化执行一次。
2. 依赖字段值变化时重新执行。

如果没有显式写 `dependencies`，它默认只监听自己。

## 运行时上下文

表达式上下文变量详见 [Schema 协议 — 表达式上下文](../schema-protocol#表达式上下文)。`expression` 只能读取变量；`computed` handler 可以调用函数、执行异步逻辑。

## 典型用法

### 1. 联动显示

下面这个例子来自项目 demo 的真实协议风格。`contactType` 变化后，`email` 字段的 `display` 会自动切换：

```json
{
  "type": "object",
  "properties": {
    "contactType": {
      "type": "string",
      "title": "联系方式",
      "component": "Select"
    },
    "email": {
      "type": "string",
      "title": "邮箱地址",
      "component": "Input",
      "x-reaction": {
        "display": {
          "type": "match",
          "dependencies": {
            "contactType": "contactType"
          },
          "match": {
            "email": "visible",
            "default": "none"
          }
        }
      }
    }
  }
}
```

### 2. 联动计算字段值

```json
{
  "x-reaction": {
    "value": {
      "type": "expression",
      "dependencies": {
        "quantity": "quantity",
        "unitPrice": "unitPrice"
      },
      "expression": "($deps.quantity || 0) * ($deps.unitPrice || 0)"
    }
  }
}
```

这类写法非常适合只读计算字段，例如总价、折扣后价格、展示名称等。

### 3. 异步加载数据源

```json
{
  "x-reaction": {
    "dataSource": {
      "type": "computed",
      "dependencies": {
        "category": "category"
      },
      "handler": "fetchSubCategories"
    }
  }
}
```

对应 handler 需要注册在 `createForm({ handlers })` 中：

```ts
const form = createForm({
  handlers: {
    fetchSubCategories: async ({ deps }) => {
      if (!deps.category) return [];
      const response = await fetch(`/api/sub-categories?category=${deps.category}`);
      const data = await response.json();
      return data.map((item) => ({ label: item.name, value: item.code }));
    },
  },
});
```

## 异步行为

`x-reaction` 只有 `computed` 规则真正支持异步。

当 handler 返回 Promise 时：

- 字段会进入 loading 状态。
- 同一个字段、同一个 reaction key，如果连续触发多次异步请求，运行时只保留最后一次完成的结果。
- 旧请求即使后返回，也不会覆盖最新状态。

这正是当前项目里异步联动不会出现“旧请求回写新状态”的原因。

## 目标属性的赋值边界

不同目标属性的赋值方式并不完全相同：

- `props` 和 `decoratorProps` 是浅合并，而不是整体替换。
- `component` 和 `decorator` 支持字符串，也支持 `[name, props]` 形式。
- `dataSource` 在写入字段前会先做标准化。
- `display: 'none'` 的字段不会参与 `form.values` 输出，也不会参与校验。
- `display: 'hidden'` 仍然保留值和校验，只是不显示。

## 什么时候该用 x-reaction

适合用 `x-reaction` 的场景：

- 字段显隐切换
- 字段标题、描述、placeholder 联动
- 只读态 / 禁用态切换
- 计算字段值
- 下拉选项异步加载
- 基于当前表单状态切换组件或装饰器

不适合用 `x-reaction` 的场景：

- 全局通知、埋点、日志上报
- 不属于字段状态派生的副作用
- 需要脱离字段模型单独编排的业务流程

这类逻辑应放在 `setup + form.effect(...)` 或外部应用层，而不是硬塞进联动规则里。
