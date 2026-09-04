# AlienForm

AlienForm 是一个以 Schema 驱动的表单工作区，采用 pnpm monorepo 组织。

## 工作区结构

- `packages/core`: 无头表单运行时内核
- `packages/react`: `core` 的 React 绑定层
- `packages/shared`: 无 CMS 业务语义的通用 adapters 与场景组件
- `apps/alien-cms`: 拥有模型、Provider、CRUD、Builder 和投影逻辑的 CMS 应用
- `apps/benchmark`: AlienForm 与 Formily 的渲染基准应用

## 当前协议

AlienForm 已收敛到更小的运行时模型：

- `required` 保留为内置 UI + 必填校验简写
- `x-validate` 是自定义校验入口
- `x-format.input` 只在初始化时执行
- `x-format.output` 在输出投影和提交时执行
- `dataSource` 支持静态值和响应式规则，选项变化后的值处理由具体组件负责

运行时值支持：

- 字面量值
- 表达式字符串：`"{{ $values.a ? b : c }}"`
- 单参数直接函数：`(scope) => any`
- 运行时值数组

表达式作用域固定为 `$values`、`$self`、`$form`、`$value`、`$row`、`$path`、
`$service(code)`、`$utils(code)`、`$enum(code)` 和 `$query`，不会扁平展开表单值。

更详细的运行时说明见 [`packages/core/README.md`](./packages/core/README.md)。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test:core
pnpm build
```
